-- ============================================================
-- 0021_branch_invoice_counters.sql
-- Invoice numbers become per (tenant, branch).
-- ============================================================

-- 1. Drop the tenant-wide unique so per-branch sequences can coexist
alter table public.invoices
  drop constraint if exists invoices_tenant_id_invoice_no_key;

alter table public.invoices
  drop constraint if exists invoices_tenant_branch_invoice_no_key;
alter table public.invoices
  add constraint invoices_tenant_branch_invoice_no_key
  unique (tenant_id, branch_id, invoice_no);

-- 2. New counter table keyed on (tenant, branch)
create table if not exists public.invoice_counters_v2 (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  branch_id  uuid not null references public.branches(id) on delete cascade,
  last_value bigint not null default 0,
  primary key (tenant_id, branch_id)
);

-- 3. Migrate existing counters: each active branch inherits the tenant counter
insert into public.invoice_counters_v2 (tenant_id, branch_id, last_value)
select ic.tenant_id, b.id, ic.last_value
from public.invoice_counters ic
join public.branches b
  on b.tenant_id = ic.tenant_id and b.is_active = true
on conflict (tenant_id, branch_id) do nothing;

drop table if exists public.invoice_counters;
alter table public.invoice_counters_v2 rename to invoice_counters;
alter table public.invoice_counters enable row level security;

drop policy if exists invoice_counters_tenant_isolation on public.invoice_counters;
create policy invoice_counters_tenant_isolation on public.invoice_counters
  for all
  using (tenant_id = public.jwt_tenant_id())
  with check (tenant_id = public.jwt_tenant_id());

-- 4. New RPC signature
drop function if exists public.next_invoice_no(uuid);

create or replace function public.next_invoice_no(p_tenant uuid, p_branch uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_next bigint;
begin
  insert into public.invoice_counters (tenant_id, branch_id, last_value)
  values (p_tenant, p_branch, 1)
  on conflict (tenant_id, branch_id)
  do update set last_value = public.invoice_counters.last_value + 1
  returning last_value into v_next;
  return 'INV-' || lpad(v_next::text, 6, '0');
end;
$$;
grant execute on function public.next_invoice_no(uuid, uuid) to authenticated;

-- 5. create_invoice now passes branch to next_invoice_no
create or replace function public.create_invoice(
  p_tenant_id    uuid,
  p_branch_id    uuid,
  p_patient_id   uuid,
  p_encounter_id uuid,
  p_notes        text,
  p_discount     numeric,
  p_items        jsonb,
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

  v_inv_no := public.next_invoice_no(p_tenant_id, p_branch_id);

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