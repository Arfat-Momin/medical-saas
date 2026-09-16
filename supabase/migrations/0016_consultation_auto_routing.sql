-- ============================================================
-- 0016_consultation_auto_routing.sql
--   - Add lab_tests to encounters
--   - Auto-route prescription -> pharmacy_queue
--   - Auto-route lab tests -> lab_orders
-- ============================================================

-- 1. Encounter gets a new JSON column for lab tests ordered during the visit
alter table public.encounters
  add column if not exists lab_tests_json jsonb not null default '[]'::jsonb;

-- 2. Pharmacy queue â€” pending prescriptions from completed consultations
create table if not exists public.pharmacy_queue (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  branch_id    uuid references public.branches(id) on delete set null,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  patient_id   uuid not null references public.patients(id) on delete cascade,
  doctor_id    uuid references public.users(id) on delete set null,
  items        jsonb not null default '[]'::jsonb,
  status       text not null default 'PENDING'
               check (status in ('PENDING','DISPENSED','CANCELLED')),
  dispense_id  uuid references public.dispenses(id) on delete set null,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (encounter_id)
);
create index if not exists idx_pharmacy_queue_tenant on public.pharmacy_queue(tenant_id);
create index if not exists idx_pharmacy_queue_status on public.pharmacy_queue(tenant_id, status);
create index if not exists idx_pharmacy_queue_patient on public.pharmacy_queue(tenant_id, patient_id);

drop trigger if exists trg_pharmacy_queue_updated on public.pharmacy_queue;
create trigger trg_pharmacy_queue_updated before update on public.pharmacy_queue
  for each row execute function public.set_updated_at();

-- 3. RLS
alter table public.pharmacy_queue enable row level security;
drop policy if exists pharmacy_queue_tenant on public.pharmacy_queue;
create policy pharmacy_queue_tenant on public.pharmacy_queue
  for all
  using (tenant_id = public.jwt_tenant_id())
  with check (tenant_id = public.jwt_tenant_id());

-- 4. Auto-route trigger on encounter completion
create or replace function public.route_encounter_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items        jsonb;
  v_lab_tests    jsonb;
  v_test         jsonb;
  v_lab_order_id uuid;
  v_total        numeric := 0;
  v_branch_id    uuid;
begin
  -- Only fire when status transitions to COMPLETED
  if new.status <> 'COMPLETED' then return new; end if;
  if old.status = 'COMPLETED' then return new; end if;

  -- Resolve branch
  v_branch_id := coalesce(
    new.branch_id,
    (select id from public.branches
     where tenant_id = new.tenant_id and is_active = true
     order by branch_code limit 1)
  );

  -- â”€â”€â”€ A. Route prescription to pharmacy queue â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  v_items := coalesce(new.prescription_json->'items', '[]'::jsonb);

  if jsonb_array_length(v_items) > 0 then
    if not exists (
      select 1 from public.pharmacy_queue where encounter_id = new.id
    ) then
      insert into public.pharmacy_queue
        (tenant_id, branch_id, encounter_id, patient_id, doctor_id, items)
      values
        (new.tenant_id, v_branch_id, new.id, new.patient_id, new.doctor_id, v_items);
    end if;
  end if;

  -- â”€â”€â”€ B. Route lab tests to lab_orders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  v_lab_tests := coalesce(new.lab_tests_json, '[]'::jsonb);

  if jsonb_array_length(v_lab_tests) > 0 then
    if not exists (
      select 1 from public.lab_orders where encounter_id = new.id
    ) then
      insert into public.lab_orders
        (tenant_id, branch_id, patient_id, doctor_id, encounter_id,
         status, priority, notes, total_amount)
      values
        (new.tenant_id, v_branch_id, new.patient_id, new.doctor_id, new.id,
         'ORDERED', 'ROUTINE', 'Auto-ordered from consultation', 0)
      returning id into v_lab_order_id;

      for v_test in select * from jsonb_array_elements(v_lab_tests)
      loop
        insert into public.lab_order_items
          (tenant_id, order_id, test_id, test_code, test_name, sample_type,
           price, reference_text)
        values
          (new.tenant_id, v_lab_order_id,
           (v_test->>'testId')::uuid,
           v_test->>'testCode',
           v_test->>'testName',
           v_test->>'sampleType',
           coalesce((v_test->>'price')::numeric, 0),
           v_test->>'referenceText');

        v_total := v_total + coalesce((v_test->>'price')::numeric, 0);
      end loop;

      update public.lab_orders set total_amount = v_total where id = v_lab_order_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_route_encounter_completion on public.encounters;
create trigger trg_route_encounter_completion
after update on public.encounters
for each row execute function public.route_encounter_completion();

-- 5. Extend save_encounter RPC to accept lab tests
-- Drop the old 4-arg version first to avoid overload ambiguity
drop function if exists public.save_encounter(uuid, uuid, jsonb, jsonb, jsonb);

create or replace function public.save_encounter(
  p_encounter_id  uuid,
  p_tenant_id     uuid,
  p_vitals        jsonb,
  p_diagnoses     jsonb,
  p_prescription  jsonb,
  p_lab_tests     jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_presc_id uuid;
begin
  -- Vitals (upsert)
  if p_vitals is not null then
    insert into public.vitals (
      tenant_id, encounter_id, temperature_c, bp_systolic, bp_diastolic,
      pulse, resp_rate, spo2, weight_kg, height_cm, bmi
    ) values (
      p_tenant_id, p_encounter_id,
      nullif(p_vitals->>'temperatureC','')::numeric,
      nullif(p_vitals->>'bpSystolic','')::integer,
      nullif(p_vitals->>'bpDiastolic','')::integer,
      nullif(p_vitals->>'pulse','')::integer,
      nullif(p_vitals->>'respRate','')::integer,
      nullif(p_vitals->>'spo2','')::integer,
      nullif(p_vitals->>'weightKg','')::numeric,
      nullif(p_vitals->>'heightCm','')::numeric,
      nullif(p_vitals->>'bmi','')::numeric
    )
    on conflict (encounter_id) do update set
      temperature_c = excluded.temperature_c,
      bp_systolic   = excluded.bp_systolic,
      bp_diastolic  = excluded.bp_diastolic,
      pulse         = excluded.pulse,
      resp_rate     = excluded.resp_rate,
      spo2          = excluded.spo2,
      weight_kg     = excluded.weight_kg,
      height_cm     = excluded.height_cm,
      bmi           = excluded.bmi,
      recorded_at   = now();
  end if;

  -- Diagnoses: replace
  if p_diagnoses is not null then
    delete from public.diagnoses where encounter_id = p_encounter_id;
    insert into public.diagnoses (tenant_id, encounter_id, diagnosis_text, icd_code, notes, is_primary)
    select
      p_tenant_id, p_encounter_id,
      item->>'diagnosisText',
      nullif(item->>'icdCode',''),
      nullif(item->>'notes',''),
      coalesce((item->>'isPrimary')::boolean, false)
    from jsonb_array_elements(p_diagnoses) as item
    where coalesce(item->>'diagnosisText','') <> '';
  end if;

  -- Prescription: upsert header + replace items
  if p_prescription is not null then
    insert into public.prescriptions (tenant_id, encounter_id, notes)
    values (p_tenant_id, p_encounter_id, nullif(p_prescription->>'notes',''))
    on conflict (encounter_id) do update set notes = excluded.notes
    returning id into v_presc_id;

    delete from public.prescription_items where prescription_id = v_presc_id;

    insert into public.prescription_items (
      tenant_id, prescription_id, medicine_name, dosage, frequency,
      duration, route, instructions, quantity
    )
    select
      p_tenant_id, v_presc_id,
      item->>'medicineName',
      nullif(item->>'dosage',''),
      nullif(item->>'frequency',''),
      nullif(item->>'duration',''),
      nullif(item->>'route',''),
      nullif(item->>'instructions',''),
      nullif(item->>'quantity','')::integer
    from jsonb_array_elements(coalesce(p_prescription->'items','[]'::jsonb)) as item
    where coalesce(item->>'medicineName','') <> '';
  end if;

  -- Lab tests (new)
  if p_lab_tests is not null then
    update public.encounters
    set lab_tests_json = p_lab_tests
    where id = p_encounter_id;
  end if;

  return p_encounter_id;
end;
$$;

grant execute on function public.save_encounter(uuid, uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;
