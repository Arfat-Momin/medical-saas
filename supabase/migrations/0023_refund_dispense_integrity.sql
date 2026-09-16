-- ============================================================
-- 0023_refund_dispense_integrity.sql
-- Fixes two data-integrity bugs found in production review:
--   1. refund_payment allowed refunding more than was paid,
--      or refunding the same payment multiple times.
--   2. dispense_items_rpc had no row lock, so two concurrent
--      dispenses on the same batch could both read available qty
--      and both succeed -> oversell.
-- ============================================================

-- ---------- Fix 1: refund_payment ----------
create or replace function public.refund_payment(
  p_tenant_id  uuid,
  p_invoice_id uuid,
  p_payment_id uuid,
  p_amount     numeric,
  p_reason     text,
  p_user_id    uuid
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_refund_id         uuid;
  v_paid_total        numeric;
  v_refunded          numeric;
  v_total             numeric;
  v_balance           numeric;
  v_status            text;
  v_payment_amount    numeric;
  v_payment_refunded  numeric;
begin
  if p_amount <= 0 then raise exception 'Refund amount must be positive'; end if;

  select total_amount into v_total from public.invoices
  where id = p_invoice_id and tenant_id = p_tenant_id;
  if v_total is null then raise exception 'Invoice not found'; end if;

  -- Payment must exist, belong to this invoice + tenant, and be locked
  select amount into v_payment_amount from public.payments
  where id = p_payment_id
    and tenant_id = p_tenant_id
    and invoice_id = p_invoice_id
  for update;
  if v_payment_amount is null then
    raise exception 'Payment not found on this invoice';
  end if;

  -- Refunds against this payment so far
  select coalesce(sum(amount), 0) into v_payment_refunded
  from public.refunds where payment_id = p_payment_id;

  if v_payment_refunded + p_amount > v_payment_amount then
    raise exception 'Refund exceeds refundable amount on this payment (paid %, refunded %, requested %)',
      v_payment_amount, v_payment_refunded, p_amount;
  end if;

  insert into public.refunds (tenant_id, invoice_id, payment_id, amount, reason, refunded_by)
  values (p_tenant_id, p_invoice_id, p_payment_id, p_amount, p_reason, p_user_id)
  returning id into v_refund_id;

  select coalesce(sum(amount),0) into v_paid_total from public.payments where invoice_id = p_invoice_id;
  select coalesce(sum(amount),0) into v_refunded   from public.refunds  where invoice_id = p_invoice_id;
  v_paid_total := v_paid_total - v_refunded;
  v_balance := v_total - v_paid_total;

  v_status := case
    when v_paid_total <= 0 then 'REFUNDED'
    when v_balance <= 0    then 'PAID'
    when v_paid_total > 0  then 'PARTIAL'
    else 'UNPAID'
  end;

  update public.invoices
  set paid_amount = v_paid_total,
      balance_amount = v_balance,
      status = v_status
  where id = p_invoice_id;

  return jsonb_build_object('refundId', v_refund_id, 'status', v_status, 'balanceAmount', v_balance);
end;
$$;

-- ---------- Fix 2: dispense_items_rpc row lock ----------
-- Same signature and body as 0009, only change is the FOR UPDATE
-- on the batch cursor so concurrent dispenses serialize.
create or replace function public.dispense_items_rpc(
  p_tenant_id   uuid,
  p_branch_id   uuid,
  p_patient_id  uuid,
  p_encounter_id uuid,
  p_items       jsonb,
  p_notes       text,
  p_user_id     uuid
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_dispense_id uuid;
  v_item        jsonb;
  v_medicine_id uuid;
  v_qty         int;
  v_remaining   int;
  v_batch       record;
  v_take        int;
  v_price       numeric;
  v_line_total  numeric;
  v_total       numeric := 0;
  v_med_name    text;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'No items to dispense';
  end if;

  insert into public.dispenses
    (tenant_id, branch_id, encounter_id, patient_id, dispensed_by, notes)
  values
    (p_tenant_id, p_branch_id, p_encounter_id, p_patient_id, p_user_id, p_notes)
  returning id into v_dispense_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_medicine_id := (v_item->>'medicineId')::uuid;
    v_qty         := (v_item->>'qty')::int;
    v_remaining   := v_qty;

    if v_qty <= 0 then
      raise exception 'Invalid quantity';
    end if;

    select name into v_med_name from public.medicines
    where id = v_medicine_id and tenant_id = p_tenant_id;
    if v_med_name is null then
      raise exception 'Medicine % not found in tenant', v_medicine_id;
    end if;

    -- FEFO with row lock so concurrent dispenses can't oversell.
    for v_batch in
      select id, current_qty, selling_price
      from public.medicine_batches
      where tenant_id = p_tenant_id
        and medicine_id = v_medicine_id
        and is_active = true
        and current_qty > 0
        and expiry_date > current_date
      order by expiry_date asc, id asc
      for update
    loop
      exit when v_remaining <= 0;

      v_take  := least(v_remaining, v_batch.current_qty);
      v_price := coalesce(v_batch.selling_price, 0);

      insert into public.stock_transactions
        (tenant_id, batch_id, medicine_id, txn_type, qty_delta,
         reference_type, reference_id, created_by)
      values
        (p_tenant_id, v_batch.id, v_medicine_id, 'DISPENSE', -v_take,
         'DISPENSE', v_dispense_id, p_user_id);

      v_line_total := v_take * v_price;
      insert into public.dispense_items
        (tenant_id, dispense_id, medicine_id, batch_id, medicine_name,
         qty, unit_price, amount)
      values
        (p_tenant_id, v_dispense_id, v_medicine_id, v_batch.id, v_med_name,
         v_take, v_price, v_line_total);

      v_total     := v_total + v_line_total;
      v_remaining := v_remaining - v_take;
    end loop;

    if v_remaining > 0 then
      raise exception 'Insufficient stock for % - short by %', v_med_name, v_remaining;
    end if;
  end loop;

  update public.dispenses set total_amount = v_total where id = v_dispense_id;

  return jsonb_build_object('dispenseId', v_dispense_id, 'totalAmount', v_total);
end;
$$;

grant execute on function public.refund_payment to authenticated;
grant execute on function public.dispense_items_rpc to authenticated;