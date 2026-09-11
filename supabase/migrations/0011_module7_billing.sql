-- ============================================================
-- 0012_module7_billing.sql
-- Hospital-internal billing — NO Razorpay.
-- ============================================================

-- ---------- Billable items (service catalog) ----------
create table public.billable_items (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  code        text,
  name        text not null,
  category    text not null default 'SERVICE'
              check (category in ('CONSULTATION','PROCEDURE','ROOM','SERVICE','OTHER')),
  price       numeric(10,2) not null default 0,
  tax_rate    numeric(5,2) not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, code)
);
create index idx_billable_tenant on public.billable_items(tenant_id);
create trigger trg_billable_updated before update on public.billable_items
  for each row execute function public.set_updated_at();

-- ---------- Invoice counter ----------
create table public.invoice_counters (
  tenant_id  uuid primary key references public.tenants(id) on delete cascade,
  last_value bigint not null default 0
);

create or replace function public.next_invoice_no(p_tenant uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_next bigint;
begin
  insert into public.invoice_counters (tenant_id, last_value)
  values (p_tenant, 1)
  on conflict (tenant_id)
  do update set last_value = public.invoice_counters.last_value + 1
  returning last_value into v_next;
  return 'INV-' || lpad(v_next::text, 6, '0');
end;
$$;
grant execute on function public.next_invoice_no to authenticated;

-- ---------- Invoices ----------
create table public.invoices (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  branch_id       uuid not null references public.branches(id) on delete restrict,
  invoice_no      text not null,
  patient_id      uuid not null references public.patients(id) on delete restrict,
  encounter_id    uuid references public.encounters(id) on delete set null,
  status          text not null default 'UNPAID'
                  check (status in ('UNPAID','PARTIAL','PAID','REFUNDED','CANCELLED')),
  subtotal        numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  tax_amount      numeric(12,2) not null default 0,
  total_amount    numeric(12,2) not null default 0,
  paid_amount     numeric(12,2) not null default 0,
  balance_amount  numeric(12,2) not null default 0,
  notes           text,
  created_by      uuid references public.users(id),
  finalized_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, invoice_no)
);
create index idx_inv_tenant   on public.invoices(tenant_id);
create index idx_inv_patient  on public.invoices(tenant_id, patient_id);
create index idx_inv_status   on public.invoices(tenant_id, status);
create index idx_inv_date     on public.invoices(tenant_id, created_at);
create trigger trg_invoices_updated before update on public.invoices
  for each row execute function public.set_updated_at();

-- ---------- Invoice items ----------
create table public.invoice_items (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  invoice_id   uuid not null references public.invoices(id) on delete cascade,
  item_type    text not null default 'MANUAL'
               check (item_type in ('MANUAL','CONSULTATION','LAB','PHARMACY','PROCEDURE','IPD')),
  source_id    uuid,
  description  text not null,
  qty          integer not null default 1 check (qty > 0),
  unit_price   numeric(10,2) not null default 0,
  discount     numeric(10,2) not null default 0,
  tax_rate     numeric(5,2) not null default 0,
  amount       numeric(12,2) not null default 0,
  created_at   timestamptz not null default now()
);
create index idx_invitems_invoice on public.invoice_items(invoice_id);

-- ---------- Payments (immutable ledger) ----------
create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  invoice_id    uuid not null references public.invoices(id) on delete restrict,
  amount        numeric(12,2) not null check (amount > 0),
  method        text not null check (method in ('CASH','CARD','UPI','NETBANKING','INSURANCE','CREDIT','OTHER')),
  reference     text,
  notes         text,
  received_by   uuid references public.users(id),
  received_at   timestamptz not null default now()
);
create index idx_pay_invoice on public.payments(invoice_id);
create index idx_pay_tenant  on public.payments(tenant_id);

-- ---------- Refunds ----------
create table public.refunds (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  invoice_id    uuid not null references public.invoices(id) on delete restrict,
  payment_id    uuid references public.payments(id) on delete set null,
  amount        numeric(12,2) not null check (amount > 0),
  reason        text not null,
  refunded_by   uuid references public.users(id),
  refunded_at   timestamptz not null default now()
);
create index idx_ref_tenant on public.refunds(tenant_id);
create index idx_ref_invoice on public.refunds(invoice_id);

-- ---------- RLS ----------
do $$
declare t text;
begin
  foreach t in array array['billable_items','invoices','invoice_items','payments','refunds','invoice_counters']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format($f$
      create policy %1$s_tenant_isolation on public.%1$I
        for all
        using (tenant_id = public.jwt_tenant_id())
        with check (tenant_id = public.jwt_tenant_id());
    $f$, t);
  end loop;
end $$;

-- ---------- RPC: create invoice with items ----------
create or replace function public.create_invoice(
  p_tenant_id    uuid,
  p_branch_id    uuid,
  p_patient_id   uuid,
  p_encounter_id uuid,
  p_notes        text,
  p_discount     numeric,
  p_items        jsonb,   -- [{ itemType, sourceId, description, qty, unitPrice, discount, taxRate }]
  p_user_id      uuid
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_inv_id     uuid;
  v_inv_no     text;
  v_item       jsonb;
  v_subtotal   numeric := 0;
  v_tax_total  numeric := 0;
  v_line_amt   numeric;
  v_line_tax   numeric;
  v_qty        int;
  v_price      numeric;
  v_disc       numeric;
  v_taxrate    numeric;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Invoice must have at least one item';
  end if;

  v_inv_no := public.next_invoice_no(p_tenant_id);

  insert into public.invoices
    (tenant_id, branch_id, invoice_no, patient_id, encounter_id, notes, discount_amount, created_by)
  values
    (p_tenant_id, p_branch_id, v_inv_no, p_patient_id, p_encounter_id, p_notes, coalesce(p_discount, 0), p_user_id)
  returning id into v_inv_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty     := greatest(coalesce((v_item->>'qty')::int, 1), 1);
    v_price   := coalesce((v_item->>'unitPrice')::numeric, 0);
    v_disc    := coalesce((v_item->>'discount')::numeric, 0);
    v_taxrate := coalesce((v_item->>'taxRate')::numeric, 0);

    v_line_amt := (v_qty * v_price) - v_disc;
    v_line_tax := round(v_line_amt * v_taxrate / 100, 2);

    insert into public.invoice_items
      (tenant_id, invoice_id, item_type, source_id, description, qty, unit_price, discount, tax_rate, amount)
    values
      (p_tenant_id, v_inv_id,
       coalesce(v_item->>'itemType','MANUAL'),
       nullif(v_item->>'sourceId','')::uuid,
       v_item->>'description',
       v_qty, v_price, v_disc, v_taxrate, v_line_amt + v_line_tax);

    v_subtotal  := v_subtotal + v_line_amt;
    v_tax_total := v_tax_total + v_line_tax;
  end loop;

  update public.invoices
  set subtotal = v_subtotal,
      tax_amount = v_tax_total,
      total_amount = v_subtotal + v_tax_total - coalesce(p_discount, 0),
      balance_amount = v_subtotal + v_tax_total - coalesce(p_discount, 0)
  where id = v_inv_id;

  return jsonb_build_object('invoiceId', v_inv_id, 'invoiceNo', v_inv_no,
                            'totalAmount', v_subtotal + v_tax_total - coalesce(p_discount, 0));
end;
$$;
grant execute on function public.create_invoice to authenticated;

-- ---------- RPC: record payment ----------
create or replace function public.record_payment(
  p_tenant_id  uuid,
  p_invoice_id uuid,
  p_amount     numeric,
  p_method     text,
  p_reference  text,
  p_notes      text,
  p_user_id    uuid
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_pay_id     uuid;
  v_paid_total numeric;
  v_total      numeric;
  v_refunded   numeric;
  v_balance    numeric;
  v_status     text;
begin
  if p_amount <= 0 then
    raise exception 'Payment amount must be positive';
  end if;

  select total_amount into v_total from public.invoices
  where id = p_invoice_id and tenant_id = p_tenant_id;
  if v_total is null then raise exception 'Invoice not found'; end if;

  insert into public.payments (tenant_id, invoice_id, amount, method, reference, notes, received_by)
  values (p_tenant_id, p_invoice_id, p_amount, p_method, p_reference, p_notes, p_user_id)
  returning id into v_pay_id;

  select coalesce(sum(amount), 0) into v_paid_total from public.payments
  where invoice_id = p_invoice_id;
  select coalesce(sum(amount), 0) into v_refunded from public.refunds
  where invoice_id = p_invoice_id;

  v_paid_total := v_paid_total - v_refunded;
  v_balance := v_total - v_paid_total;

  v_status := case
    when v_balance <= 0 then 'PAID'
    when v_paid_total > 0 then 'PARTIAL'
    else 'UNPAID'
  end;

  update public.invoices
  set paid_amount = v_paid_total,
      balance_amount = v_balance,
      status = v_status,
      finalized_at = coalesce(finalized_at, now())
  where id = p_invoice_id;

  return jsonb_build_object(
    'paymentId', v_pay_id,
    'paidAmount', v_paid_total,
    'balanceAmount', v_balance,
    'status', v_status
  );
end;
$$;
grant execute on function public.record_payment to authenticated;

-- ---------- RPC: refund ----------
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
  v_refund_id  uuid;
  v_paid_total numeric;
  v_refunded   numeric;
  v_total      numeric;
  v_balance    numeric;
  v_status     text;
begin
  if p_amount <= 0 then raise exception 'Refund amount must be positive'; end if;

  select total_amount into v_total from public.invoices
  where id = p_invoice_id and tenant_id = p_tenant_id;
  if v_total is null then raise exception 'Invoice not found'; end if;

  insert into public.refunds (tenant_id, invoice_id, payment_id, amount, reason, refunded_by)
  values (p_tenant_id, p_invoice_id, p_payment_id, p_amount, p_reason, p_user_id)
  returning id into v_refund_id;

  select coalesce(sum(amount),0) into v_paid_total from public.payments where invoice_id = p_invoice_id;
  select coalesce(sum(amount),0) into v_refunded   from public.refunds  where invoice_id = p_invoice_id;
  v_paid_total := v_paid_total - v_refunded;
  v_balance := v_total - v_paid_total;

  v_status := case
    when v_paid_total <= 0 then 'REFUNDED'
    when v_balance <= 0 then 'PAID'
    when v_paid_total > 0 then 'PARTIAL'
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
grant execute on function public.refund_payment to authenticated;
