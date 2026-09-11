-- ============================================================
-- 0011_module6_laboratory.sql
-- Tests master, orders, samples, results, verification.
-- ============================================================

-- ---------- Test master ----------
create table public.lab_tests (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  code            text,
  name            text not null,
  category        text,                     -- Hematology, Biochemistry, Microbiology, Serology, Urine, etc.
  sample_type     text,                     -- Blood, Urine, Stool, Swab, Serum, Plasma
  unit            text,                     -- mg/dL, g/dL, /μL, etc.
  reference_min   numeric(12,3),
  reference_max   numeric(12,3),
  reference_text  text,                     -- free-text (e.g., "Negative", "0-5 /hpf")
  price           numeric(10,2) not null default 0,
  turnaround_hrs  integer default 24,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, code)
);
create index idx_labtests_tenant on public.lab_tests(tenant_id);
create index idx_labtests_name   on public.lab_tests(tenant_id, name);
create trigger trg_labtests_updated before update on public.lab_tests
  for each row execute function public.set_updated_at();

-- ---------- Orders ----------
create table public.lab_orders (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  branch_id       uuid not null references public.branches(id) on delete restrict,
  patient_id      uuid not null references public.patients(id) on delete restrict,
  doctor_id       uuid not null references public.users(id) on delete restrict,
  encounter_id    uuid references public.encounters(id) on delete set null,
  order_date      date not null default current_date,
  status          text not null default 'ORDERED'
                  check (status in ('ORDERED','COLLECTED','RESULTED','VERIFIED','CANCELLED')),
  priority        text not null default 'ROUTINE' check (priority in ('ROUTINE','URGENT','STAT')),
  notes           text,
  total_amount    numeric(12,2) not null default 0,
  created_by      uuid references public.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_laborder_tenant   on public.lab_orders(tenant_id);
create index idx_laborder_patient  on public.lab_orders(tenant_id, patient_id);
create index idx_laborder_status   on public.lab_orders(tenant_id, status);
create index idx_laborder_date     on public.lab_orders(tenant_id, order_date);
create trigger trg_laborder_updated before update on public.lab_orders
  for each row execute function public.set_updated_at();

-- ---------- Order items ----------
create table public.lab_order_items (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  order_id        uuid not null references public.lab_orders(id) on delete cascade,
  test_id         uuid not null references public.lab_tests(id) on delete restrict,
  test_code       text,
  test_name       text not null,
  sample_type     text,
  price           numeric(10,2) not null default 0,
  result_value    text,
  result_unit     text,
  reference_text  text,
  flag            text check (flag in ('NORMAL','HIGH','LOW','ABNORMAL','CRITICAL')),
  resulted_by     uuid references public.users(id),
  resulted_at     timestamptz,
  verified_by     uuid references public.users(id),
  verified_at     timestamptz,
  remarks         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_labitem_order on public.lab_order_items(order_id);
create trigger trg_labitem_updated before update on public.lab_order_items
  for each row execute function public.set_updated_at();

-- ---------- Samples ----------
create table public.lab_samples (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  order_id        uuid not null references public.lab_orders(id) on delete cascade,
  sample_type     text not null,
  barcode         text,
  collected_by    uuid references public.users(id),
  collected_at    timestamptz not null default now(),
  notes           text,
  created_at      timestamptz not null default now()
);
create index idx_labsample_order on public.lab_samples(order_id);

-- ---------- RLS ----------
do $$
declare t text;
begin
  foreach t in array array[
    'lab_tests','lab_orders','lab_order_items','lab_samples'
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

-- ---------- RPC: create lab order with items atomically ----------
create or replace function public.create_lab_order(
  p_tenant_id    uuid,
  p_branch_id    uuid,
  p_patient_id   uuid,
  p_doctor_id    uuid,
  p_encounter_id uuid,
  p_priority     text,
  p_notes        text,
  p_test_ids     uuid[],
  p_user_id      uuid
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_order_id uuid;
  v_total    numeric := 0;
  v_test     record;
begin
  if p_test_ids is null or array_length(p_test_ids, 1) is null then
    raise exception 'No tests supplied';
  end if;

  insert into public.lab_orders
    (tenant_id, branch_id, patient_id, doctor_id, encounter_id, priority, notes, created_by)
  values
    (p_tenant_id, p_branch_id, p_patient_id, p_doctor_id, p_encounter_id, coalesce(p_priority,'ROUTINE'), p_notes, p_user_id)
  returning id into v_order_id;

  for v_test in
    select * from public.lab_tests
    where tenant_id = p_tenant_id and id = any(p_test_ids)
  loop
    insert into public.lab_order_items
      (tenant_id, order_id, test_id, test_code, test_name, sample_type, price, reference_text)
    values
      (p_tenant_id, v_order_id, v_test.id, v_test.code, v_test.name, v_test.sample_type, v_test.price,
       coalesce(v_test.reference_text,
         case
           when v_test.reference_min is not null and v_test.reference_max is not null
           then v_test.reference_min::text || ' – ' || v_test.reference_max::text || ' ' || coalesce(v_test.unit,'')
           else null
         end));
    v_total := v_total + v_test.price;
  end loop;

  update public.lab_orders set total_amount = v_total where id = v_order_id;

  return jsonb_build_object('orderId', v_order_id, 'totalAmount', v_total);
end;
$$;
grant execute on function public.create_lab_order to authenticated;