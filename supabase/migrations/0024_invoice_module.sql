-- =========================================================================
-- Invoice module redesign: doc / med / lab / inv
-- =========================================================================

-- ---- 1. Extend invoices table -------------------------------------------
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_type text NOT NULL DEFAULT 'COMBINED',
  ADD COLUMN IF NOT EXISTS source_reference_id uuid,
  ADD COLUMN IF NOT EXISTS parent_invoice_id uuid;

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_type_check;
ALTER TABLE invoices
  ADD CONSTRAINT invoices_type_check
  CHECK (invoice_type IN ('COMBINED', 'DOCTOR', 'PHARMACY', 'LAB'));

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_type
  ON invoices(tenant_id, invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_patient_type
  ON invoices(tenant_id, patient_id, invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_source
  ON invoices(tenant_id, invoice_type, source_reference_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_source
  ON invoices(tenant_id, invoice_type, source_reference_id)
  WHERE invoice_type IN ('DOCTOR','PHARMACY','LAB')
    AND source_reference_id IS NOT NULL
    AND status <> 'CANCELLED';

-- ---- 2. Per-type invoice counters ---------------------------------------
DROP TABLE IF EXISTS invoice_counters CASCADE;

CREATE TABLE invoice_counters (
  tenant_id    uuid   NOT NULL,
  branch_id    uuid   NOT NULL,
  invoice_type text   NOT NULL DEFAULT 'COMBINED',
  last_value   bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, branch_id, invoice_type)
);

ALTER TABLE invoice_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoice_counters_tenant_isolation ON invoice_counters
  FOR ALL
  USING      (tenant_id = jwt_tenant_id())
  WITH CHECK (tenant_id = jwt_tenant_id());

-- ---- 3. next_invoice_number(tenant, branch, type) -----------------------
CREATE OR REPLACE FUNCTION next_invoice_number(
  p_tenant uuid, p_branch uuid, p_type text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_seq bigint;
  v_prefix text;
  v_ym text;
BEGIN
  v_prefix := CASE upper(p_type)
    WHEN 'DOCTOR'   THEN 'doc'
    WHEN 'PHARMACY' THEN 'med'
    WHEN 'LAB'      THEN 'lab'
    ELSE 'inv'
  END;
  v_ym := to_char(now(), 'YYYYMM');

  INSERT INTO invoice_counters (tenant_id, branch_id, invoice_type, last_value)
  VALUES (p_tenant, p_branch, upper(p_type), 1)
  ON CONFLICT (tenant_id, branch_id, invoice_type)
  DO UPDATE SET last_value = invoice_counters.last_value + 1
  RETURNING last_value INTO v_seq;

  RETURN v_prefix || '-' || v_ym || '-' || lpad(v_seq::text, 5, '0');
END;
$$;

-- ---- 4. sync_source_invoice(tenant, user, type, source_id) --------------
CREATE OR REPLACE FUNCTION sync_source_invoice(
  p_tenant_id   uuid,
  p_user_id     uuid,
  p_source_type text,   -- 'DOCTOR' | 'PHARMACY' | 'LAB'
  p_source_id   uuid    -- encounter_id | dispense_id | lab_order_id
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_invoice_id  uuid;
  v_branch_id   uuid;
  v_patient_id  uuid;
  v_encounter   uuid;
  v_invoice_no  text;
  v_item        record;
  v_fee         numeric;
  v_doctor_name text;
  v_total       numeric := 0;
BEGIN
  IF p_source_type = 'DOCTOR' THEN
    SELECT branch_id, patient_id, id INTO v_branch_id, v_patient_id, v_encounter
      FROM encounters WHERE id = p_source_id AND tenant_id = p_tenant_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Encounter % not found', p_source_id; END IF;
    PERFORM 1 FROM encounters WHERE id = p_source_id AND status = 'COMPLETED';
    IF NOT FOUND THEN RETURN NULL; END IF;

  ELSIF p_source_type = 'PHARMACY' THEN
    SELECT branch_id, patient_id, encounter_id INTO v_branch_id, v_patient_id, v_encounter
      FROM dispenses WHERE id = p_source_id AND tenant_id = p_tenant_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Dispense % not found', p_source_id; END IF;

  ELSIF p_source_type = 'LAB' THEN
    SELECT branch_id, patient_id, encounter_id INTO v_branch_id, v_patient_id, v_encounter
      FROM lab_orders WHERE id = p_source_id AND tenant_id = p_tenant_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Lab order % not found', p_source_id; END IF;

  ELSE
    RAISE EXCEPTION 'Unknown source_type: %', p_source_type;
  END IF;

  v_branch_id := COALESCE(v_branch_id,
    (SELECT id FROM branches WHERE tenant_id = p_tenant_id AND is_active
     ORDER BY branch_code LIMIT 1));

  SELECT id INTO v_invoice_id FROM invoices
    WHERE tenant_id = p_tenant_id
      AND invoice_type = p_source_type
      AND source_reference_id = p_source_id
      AND status <> 'CANCELLED'
    LIMIT 1;

  IF v_invoice_id IS NULL THEN
    v_invoice_no := next_invoice_number(p_tenant_id, v_branch_id, p_source_type);
    INSERT INTO invoices (
      tenant_id, branch_id, invoice_no, patient_id, encounter_id,
      status, subtotal, discount_amount, tax_amount, total_amount,
      paid_amount, balance_amount, created_by,
      invoice_type, source_reference_id
    ) VALUES (
      p_tenant_id, v_branch_id, v_invoice_no, v_patient_id, v_encounter,
      'UNPAID', 0, 0, 0, 0, 0, 0, p_user_id,
      p_source_type, p_source_id
    ) RETURNING id INTO v_invoice_id;
  END IF;

  DELETE FROM invoice_items WHERE invoice_id = v_invoice_id;

  IF p_source_type = 'DOCTOR' THEN
    SELECT u.consultation_fee, u.full_name INTO v_fee, v_doctor_name
      FROM encounters e JOIN users u ON u.id = e.doctor_id
      WHERE e.id = p_source_id;

    IF COALESCE(v_fee, 0) > 0 THEN
      INSERT INTO invoice_items (
        tenant_id, invoice_id, item_type, source_id, description,
        qty, unit_price, discount, tax_rate, amount
      ) VALUES (
        p_tenant_id, v_invoice_id, 'CONSULTATION', p_source_id,
        'Consultation fee - Dr. ' || COALESCE(v_doctor_name, ''),
        1, v_fee, 0, 0, v_fee
      );
    END IF;

  ELSIF p_source_type = 'PHARMACY' THEN
    FOR v_item IN
      SELECT medicine_name, qty, unit_price, amount
        FROM dispense_items
        WHERE dispense_id = p_source_id AND tenant_id = p_tenant_id
    LOOP
      INSERT INTO invoice_items (
        tenant_id, invoice_id, item_type, source_id, description,
        qty, unit_price, discount, tax_rate, amount
      ) VALUES (
        p_tenant_id, v_invoice_id, 'PHARMACY', p_source_id,
        'Medicine: ' || v_item.medicine_name,
        v_item.qty, v_item.unit_price, 0, 0, v_item.amount
      );
    END LOOP;

  ELSIF p_source_type = 'LAB' THEN
    FOR v_item IN
      SELECT test_name, price FROM lab_order_items
        WHERE order_id = p_source_id AND tenant_id = p_tenant_id
    LOOP
      INSERT INTO invoice_items (
        tenant_id, invoice_id, item_type, source_id, description,
        qty, unit_price, discount, tax_rate, amount
      ) VALUES (
        p_tenant_id, v_invoice_id, 'LAB', p_source_id,
        'Lab: ' || v_item.test_name,
        1, v_item.price, 0, 0, v_item.price
      );
    END LOOP;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_total
    FROM invoice_items WHERE invoice_id = v_invoice_id;

  UPDATE invoices SET
    subtotal = v_total,
    total_amount = v_total,
    balance_amount = GREATEST(v_total - paid_amount, 0),
    updated_at = now()
  WHERE id = v_invoice_id;

  RETURN v_invoice_id;
END;
$$;

-- ---- 5. sync_combined_invoice(tenant, user, patient_id) -----------------
CREATE OR REPLACE FUNCTION sync_combined_invoice(
  p_tenant_id uuid, p_user_id uuid, p_patient_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_invoice_id uuid;
  v_branch_id  uuid;
  v_invoice_no text;
  v_item       record;
  v_total      numeric := 0;
  v_paid       numeric := 0;
  v_balance    numeric := 0;
  v_status     text;
BEGIN
  SELECT id INTO v_invoice_id FROM invoices
    WHERE tenant_id = p_tenant_id
      AND patient_id = p_patient_id
      AND invoice_type = 'COMBINED'
      AND status NOT IN ('PAID', 'CANCELLED')
    ORDER BY created_at DESC LIMIT 1;

  IF v_invoice_id IS NULL THEN
    SELECT branch_id INTO v_branch_id FROM encounters
      WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id
      ORDER BY created_at DESC LIMIT 1;

    v_branch_id := COALESCE(v_branch_id,
      (SELECT id FROM branches WHERE tenant_id = p_tenant_id AND is_active
       ORDER BY branch_code LIMIT 1));

    v_invoice_no := next_invoice_number(p_tenant_id, v_branch_id, 'COMBINED');

    INSERT INTO invoices (
      tenant_id, branch_id, invoice_no, patient_id,
      status, subtotal, discount_amount, tax_amount, total_amount,
      paid_amount, balance_amount, created_by, invoice_type
    ) VALUES (
      p_tenant_id, v_branch_id, v_invoice_no, p_patient_id,
      'UNPAID', 0, 0, 0, 0, 0, 0, p_user_id, 'COMBINED'
    ) RETURNING id INTO v_invoice_id;
  END IF;

  DELETE FROM invoice_items WHERE invoice_id = v_invoice_id;

  FOR v_item IN
    SELECT ii.* FROM invoice_items ii
      JOIN invoices i ON i.id = ii.invoice_id
      WHERE i.tenant_id = p_tenant_id
        AND i.patient_id = p_patient_id
        AND i.invoice_type IN ('DOCTOR','PHARMACY','LAB')
        AND i.status <> 'CANCELLED'
  LOOP
    INSERT INTO invoice_items (
      tenant_id, invoice_id, item_type, source_id, description,
      qty, unit_price, discount, tax_rate, amount
    ) VALUES (
      p_tenant_id, v_invoice_id, v_item.item_type, v_item.source_id,
      v_item.description, v_item.qty, v_item.unit_price,
      v_item.discount, v_item.tax_rate, v_item.amount
    );
  END LOOP;

  SELECT COALESCE(SUM(amount), 0) INTO v_total
    FROM invoice_items WHERE invoice_id = v_invoice_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
    FROM payments WHERE invoice_id = v_invoice_id;

  v_balance := GREATEST(v_total - v_paid, 0);

  IF v_paid <= 0 THEN v_status := 'UNPAID';
  ELSIF v_paid >= v_total THEN v_status := 'PAID';
  ELSE v_status := 'PARTIAL';
  END IF;

  UPDATE invoices SET
    subtotal = v_total,
    total_amount = v_total,
    paid_amount = v_paid,
    balance_amount = v_balance,
    status = v_status,
    updated_at = now()
  WHERE id = v_invoice_id;

  RETURN v_invoice_id;
END;
$$;

-- ---- 6. Backwards-compat: sync_invoice_from_encounter wraps the above ---
CREATE OR REPLACE FUNCTION sync_invoice_from_encounter(
  p_tenant_id uuid, p_user_id uuid, p_encounter_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_patient_id uuid;
  v_row        record;
BEGIN
  SELECT patient_id INTO v_patient_id FROM encounters
    WHERE id = p_encounter_id AND tenant_id = p_tenant_id;
  IF v_patient_id IS NULL THEN RETURN NULL; END IF;

  PERFORM sync_source_invoice(p_tenant_id, p_user_id, 'DOCTOR', p_encounter_id);

  FOR v_row IN
    SELECT id FROM dispenses
      WHERE encounter_id = p_encounter_id AND tenant_id = p_tenant_id
  LOOP
    PERFORM sync_source_invoice(p_tenant_id, p_user_id, 'PHARMACY', v_row.id);
  END LOOP;

  FOR v_row IN
    SELECT id FROM lab_orders
      WHERE encounter_id = p_encounter_id AND tenant_id = p_tenant_id
  LOOP
    PERFORM sync_source_invoice(p_tenant_id, p_user_id, 'LAB', v_row.id);
  END LOOP;

  RETURN sync_combined_invoice(p_tenant_id, p_user_id, v_patient_id);
END;
$$;

-- ---- 7. Backfill existing invoices as COMBINED --------------------------
UPDATE invoices SET invoice_type = 'COMBINED'
  WHERE invoice_type IS NULL OR invoice_type = '';

-- ---- Done ---------------------------------------------------------------