-- ============================================================
-- 0010_module5_pharmacy.sql
-- Medicines, suppliers, batches, purchases, stock ledger,
-- dispensing with FEFO allocation.
-- ============================================================

-- ---------- Medicines ----------
create table public.medicines (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  code           text,
  name           text not null,
  generic_name   text,
  manufacturer   text,
  category       text,   -- Tablet, Syrup, Injection, Capsule, Ointment, Drops
  unit           text,   -- tab, ml, vial
  hsn_code       text,
  gst_rate       numeric(5,2) default 0,
  reorder_level  integer not null default 10,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (tenant_id, code)
);
create index idx_medicines_tenant on public.medicines(tenant_id);
create index idx_medicines_name   on public.medicines(tenant_id, name);
create trigger trg_medicines_updated before update on public.medicines
  for each row execute function public.set_updated_at();

-- ---------- Suppliers ----------
create table public.suppliers (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  code           text,
  name           text not null,
  contact_person text,
  phone          text,
  email          text,
  address        text,
  gstin          text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (tenant_id, code)
);
create index idx_suppliers_tenant on public.suppliers(tenant_id);
create trigger trg_suppliers_updated before update on public.suppliers
  for each row execute function public.set_updated_at();

-- ---------- Batches ----------
create table public.medicine_batches (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  medicine_id    uuid not null references public.medicines(id) on delete restrict,
  batch_no       text not null,
  expiry_date    date not null,
  mrp            numeric(10,2),
  purchase_price numeric(10,2),
  selling_price  numeric(10,2),
  current_qty    integer not null default 0,   -- maintained ONLY via stock_transactions
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (tenant_id, medicine_id, batch_no)
);
create index idx_batches_tenant   on public.medicine_batches(tenant_id);
create index idx_batches_medicine on public.medicine_batches(tenant_id, medicine_id);
create index idx_batches_expiry   on public.medicine_batches(tenant_id, expiry_date);
create trigger trg_batches_updated before update on public.medicine_batches
  for each row execute function public.set_updated_at();

-- ---------- Stock transactions (immutable ledger) ----------
create table public.stock_transactions (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  batch_id        uuid not null references public.medicine_batches(id) on delete restrict,
  medicine_id     uuid not null references public.medicines(id) on delete restrict,
  txn_type        text not null check (txn_type in ('PURCHASE','DISPENSE','ADJUSTMENT','WASTAGE','RETURN_IN','RETURN_OUT')),
  qty_delta       integer not null,             -- + for IN, - for OUT (never 0)
  reference_type  text,                          -- 'PURCHASE','DISPENSE','MANUAL'
  reference_id    uuid,
  notes           text,
  created_by      uuid references public.users(id),
  created_at      timestamptz not null default now(),
  check (qty_delta <> 0)
);
create index idx_stx_tenant   on public.stock_transactions(tenant_id);
create index idx_stx_batch    on public.stock_transactions(tenant_id, batch_id);
create index idx_stx_medicine on public.stock_transactions(tenant_id, medicine_id);
create index idx_stx_ref      on public.stock_transactions(reference_type, reference_id);

-- Apply each transaction to batch.current_qty via trigger (immutable ledger → running total)
create or replace function public.apply_stock_transaction()
returns trigger language plpgsql as $$
begin
  update public.medicine_batches
  set current_qty = current_qty + new.qty_delta,
      updated_at  = now()
  where id = new.batch_id;

  -- Guard: never allow negative stock
  if exists (select 1 from public.medicine_batches where id = new.batch_id and current_qty < 0) then
    raise exception 'Stock cannot go negative for batch %', new.batch_id;
  end if;

  return new;
end;
$$;

create trigger trg_stock_apply after insert on public.stock_transactions
  for each row execute function public.apply_stock_transaction();

-- ---------- Purchases ----------
create table public.purchases (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  supplier_id    uuid not null references public.suppliers(id) on delete restrict,
  invoice_no     text,
  purchase_date  date not null default current_date,
  total_amount   numeric(12,2) not null default 0,
  status         text not null default 'DRAFT' check (status in ('DRAFT','RECEIVED','CANCELLED')),
  notes          text,
  created_by     uuid references public.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index idx_purch_tenant   on public.purchases(tenant_id);
create index idx_purch_supplier on public.purchases(tenant_id, supplier_id);
create trigger trg_purchases_updated before update on public.purchases
  for each row execute function public.set_updated_at();

-- ---------- Dispenses ----------
create table public.dispenses (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  branch_id      uuid references public.branches(id) on delete set null,
  encounter_id   uuid references public.encounters(id) on delete set null,
  patient_id     uuid not null references public.patients(id) on delete restrict,
  dispensed_by   uuid references public.users(id),
  total_amount   numeric(12,2) not null default 0,
  notes          text,
  created_at     timestamptz not null default now()
);
create index idx_disp_tenant    on public.dispenses(tenant_id);
create index idx_disp_patient   on public.dispenses(tenant_id, patient_id);
create index idx_disp_encounter on public.dispenses(tenant_id, encounter_id);

create table public.dispense_items (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  dispense_id    uuid not null references public.dispenses(id) on delete cascade,
  medicine_id    uuid not null references public.medicines(id) on delete restrict,
  batch_id       uuid not null references public.medicine_batches(id) on delete restrict,
  medicine_name  text not null,
  qty            integer not null check (qty > 0),
  unit_price     numeric(10,2) not null default 0,
  amount         numeric(12,2) not null default 0,
  created_at     timestamptz not null default now()
);
create index idx_dispitems_disp on public.dispense_items(dispense_id);

-- ---------- RLS ----------
do $$
declare t text;
begin
  foreach t in array array[
    'medicines','suppliers','medicine_batches','stock_transactions',
    'purchases','dispenses','dispense_items'
  ]
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

-- ---------- RPC: receive purchase (creates batches + stock IN atomically) ----------
create or replace function public.receive_purchase(
  p_tenant_id   uuid,
  p_supplier_id uuid,
  p_invoice_no  text,
  p_date        date,
  p_notes       text,
  p_items       jsonb,  -- [{ medicineId, batchNo, expiryDate, qty, purchasePrice, mrp, sellingPrice }]
  p_user_id     uuid
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_purchase_id uuid;
  v_item        jsonb;
  v_batch_id    uuid;
  v_qty         int;
  v_total       numeric := 0;
  v_line_total  numeric;
  v_pprice      numeric;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'No items supplied';
  end if;

  insert into public.purchases
    (tenant_id, supplier_id, invoice_no, purchase_date, status, notes, created_by)
  values
    (p_tenant_id, p_supplier_id, p_invoice_no, coalesce(p_date, current_date), 'RECEIVED', p_notes, p_user_id)
  returning id into v_purchase_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty    := (v_item->>'qty')::int;
    v_pprice := coalesce((v_item->>'purchasePrice')::numeric, 0);

    if v_qty <= 0 then
      raise exception 'Invalid quantity in purchase item';
    end if;

    -- Upsert batch
    insert into public.medicine_batches
      (tenant_id, medicine_id, batch_no, expiry_date, mrp, purchase_price, selling_price)
    values
      (p_tenant_id,
       (v_item->>'medicineId')::uuid,
       v_item->>'batchNo',
       (v_item->>'expiryDate')::date,
       nullif(v_item->>'mrp','')::numeric,
       v_pprice,
       nullif(v_item->>'sellingPrice','')::numeric)
    on conflict (tenant_id, medicine_id, batch_no)
    do update set
      expiry_date    = excluded.expiry_date,
      mrp            = coalesce(excluded.mrp, public.medicine_batches.mrp),
      purchase_price = excluded.purchase_price,
      selling_price  = coalesce(excluded.selling_price, public.medicine_batches.selling_price)
    returning id into v_batch_id;

    -- Stock IN
    insert into public.stock_transactions
      (tenant_id, batch_id, medicine_id, txn_type, qty_delta, reference_type, reference_id, created_by)
    values
      (p_tenant_id, v_batch_id, (v_item->>'medicineId')::uuid, 'PURCHASE', v_qty, 'PURCHASE', v_purchase_id, p_user_id);

    v_line_total := v_qty * v_pprice;
    v_total := v_total + v_line_total;
  end loop;

  update public.purchases set total_amount = v_total where id = v_purchase_id;

  return jsonb_build_object('purchaseId', v_purchase_id, 'totalAmount', v_total);
end;
$$;
grant execute on function public.receive_purchase to authenticated;

-- ---------- RPC: dispense with FEFO allocation ----------
create or replace function public.dispense_items_rpc(
  p_tenant_id   uuid,
  p_branch_id   uuid,
  p_patient_id  uuid,
  p_encounter_id uuid,
  p_items       jsonb,   -- [{ medicineId, qty }]
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

    select name into v_med_name from public.medicines where id = v_medicine_id and tenant_id = p_tenant_id;
    if v_med_name is null then
      raise exception 'Medicine % not found in tenant', v_medicine_id;
    end if;

    -- FEFO: earliest expiry first
    for v_batch in
      select id, current_qty, selling_price
      from public.medicine_batches
      where tenant_id = p_tenant_id
        and medicine_id = v_medicine_id
        and is_active = true
        and current_qty > 0
        and expiry_date > current_date
      order by expiry_date asc, id asc
    loop
      exit when v_remaining <= 0;

      v_take  := least(v_remaining, v_batch.current_qty);
      v_price := coalesce(v_batch.selling_price, 0);

      insert into public.stock_transactions
        (tenant_id, batch_id, medicine_id, txn_type, qty_delta, reference_type, reference_id, created_by)
      values
        (p_tenant_id, v_batch.id, v_medicine_id, 'DISPENSE', -v_take, 'DISPENSE', v_dispense_id, p_user_id);

      v_line_total := v_take * v_price;
      insert into public.dispense_items
        (tenant_id, dispense_id, medicine_id, batch_id, medicine_name, qty, unit_price, amount)
      values
        (p_tenant_id, v_dispense_id, v_medicine_id, v_batch.id, v_med_name, v_take, v_price, v_line_total);

      v_total := v_total + v_line_total;
      v_remaining := v_remaining - v_take;
    end loop;

    if v_remaining > 0 then
      raise exception 'Insufficient stock for % — short by %', v_med_name, v_remaining;
    end if;
  end loop;

  update public.dispenses set total_amount = v_total where id = v_dispense_id;

  return jsonb_build_object('dispenseId', v_dispense_id, 'totalAmount', v_total);
end;
$$;
grant execute on function public.dispense_items_rpc to authenticated;

-- ---------- RPC: adjust stock (wastage / correction) ----------
create or replace function public.adjust_stock(
  p_tenant_id  uuid,
  p_batch_id   uuid,
  p_qty_delta  integer,
  p_reason     text,
  p_user_id    uuid
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_txn_id uuid;
  v_med_id uuid;
begin
  if p_qty_delta = 0 then
    raise exception 'Adjustment cannot be zero';
  end if;

  select medicine_id into v_med_id from public.medicine_batches where id = p_batch_id and tenant_id = p_tenant_id;
  if v_med_id is null then
    raise exception 'Batch not found';
  end if;

  insert into public.stock_transactions
    (tenant_id, batch_id, medicine_id, txn_type, qty_delta, reference_type, notes, created_by)
  values
    (p_tenant_id, p_batch_id, v_med_id,
     case when p_qty_delta > 0 then 'ADJUSTMENT' else 'WASTAGE' end,
     p_qty_delta, 'MANUAL', p_reason, p_user_id)
  returning id into v_txn_id;

  return v_txn_id;
end;
$$;
grant execute on function public.adjust_stock to authenticated;

-- ---------- Views: low stock + expiring ----------
create or replace view public.v_low_stock as
select
  m.tenant_id,
  m.id as medicine_id,
  m.name,
  m.reorder_level,
  coalesce(sum(b.current_qty), 0)::int as total_qty
from public.medicines m
left join public.medicine_batches b on b.medicine_id = m.id and b.is_active = true
where m.is_active = true
group by m.tenant_id, m.id, m.name, m.reorder_level
having coalesce(sum(b.current_qty), 0) <= m.reorder_level;

create or replace view public.v_expiring_batches as
select
  b.tenant_id, b.id as batch_id, b.batch_no, b.expiry_date, b.current_qty,
  m.id as medicine_id, m.name as medicine_name
from public.medicine_batches b
join public.medicines m on m.id = b.medicine_id
where b.is_active = true
  and b.current_qty > 0
  and b.expiry_date <= current_date + interval '90 days';

-- RLS on views inherits from base tables via security_invoker
alter view public.v_low_stock set (security_invoker = true);
alter view public.v_expiring_batches set (security_invoker = true);
