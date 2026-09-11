-- ============================================================
-- 0013_module8_ipd.sql
-- IPD: locations tree, beds, admissions, transfers,
-- nursing notes, doctor rounds, MAR (medication administration).
-- ============================================================

-- ---------- Locations (self-referencing tree) ----------
create table public.locations (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  branch_id   uuid not null references public.branches(id) on delete cascade,
  parent_id   uuid references public.locations(id) on delete cascade,
  type        text not null check (type in ('FACILITY','BUILDING','FLOOR','WARD','ROOM','BED')),
  name        text not null,
  code        text,
  capacity    integer,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_loc_tenant   on public.locations(tenant_id);
create index idx_loc_branch   on public.locations(tenant_id, branch_id);
create index idx_loc_parent   on public.locations(parent_id);
create index idx_loc_type     on public.locations(tenant_id, type);
create trigger trg_loc_updated before update on public.locations
  for each row execute function public.set_updated_at();

-- ---------- Admissions ----------
create table public.admissions (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  branch_id         uuid not null references public.branches(id) on delete restrict,
  patient_id        uuid not null references public.patients(id) on delete restrict,
  bed_id            uuid not null references public.locations(id) on delete restrict,
  admitting_doctor  uuid not null references public.users(id) on delete restrict,
  admitted_at       timestamptz not null default now(),
  expected_discharge date,
  discharged_at     timestamptz,
  status            text not null default 'ADMITTED'
                    check (status in ('ADMITTED','TRANSFERRED','DISCHARGED','CANCELLED')),
  reason            text,
  diagnosis         text,
  notes             text,
  discharge_summary text,
  discharge_type    text check (discharge_type in ('NORMAL','AGAINST_ADVICE','TRANSFER','DEATH','ABSCONDED')),
  created_by        uuid references public.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_adm_tenant    on public.admissions(tenant_id);
create index idx_adm_patient   on public.admissions(tenant_id, patient_id);
create index idx_adm_bed       on public.admissions(tenant_id, bed_id);
create index idx_adm_status    on public.admissions(tenant_id, status);
create trigger trg_adm_updated before update on public.admissions
  for each row execute function public.set_updated_at();

-- One active admission per bed
create unique index uniq_adm_active_bed on public.admissions(bed_id)
  where status in ('ADMITTED','TRANSFERRED');

-- ---------- Bed transfers (immutable log) ----------
create table public.bed_transfers (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  admission_id  uuid not null references public.admissions(id) on delete cascade,
  from_bed_id   uuid references public.locations(id) on delete set null,
  to_bed_id     uuid not null references public.locations(id) on delete restrict,
  reason        text not null,
  transferred_by uuid references public.users(id),
  transferred_at timestamptz not null default now()
);
create index idx_trans_adm on public.bed_transfers(admission_id);

-- ---------- Nursing notes ----------
create table public.nursing_notes (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  admission_id  uuid not null references public.admissions(id) on delete cascade,
  note_type     text not null default 'GENERAL'
                check (note_type in ('GENERAL','VITALS','MEDICATION','OBSERVATION','INCIDENT','HANDOVER')),
  note          text not null,
  recorded_by   uuid references public.users(id),
  recorded_at   timestamptz not null default now()
);
create index idx_nursing_adm on public.nursing_notes(admission_id);

-- ---------- Doctor rounds ----------
create table public.doctor_rounds (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  admission_id  uuid not null references public.admissions(id) on delete cascade,
  doctor_id     uuid not null references public.users(id) on delete restrict,
  round_at      timestamptz not null default now(),
  clinical_notes text,
  assessment    text,
  plan          text,
  created_at    timestamptz not null default now()
);
create index idx_rounds_adm on public.doctor_rounds(admission_id);

-- ---------- MAR (Medication Administration Record) ----------
create table public.mar_records (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  admission_id      uuid not null references public.admissions(id) on delete cascade,
  medication_name   text not null,
  dose              text,
  route             text,
  scheduled_at      timestamptz not null,
  administered_at   timestamptz,
  administered_by   uuid references public.users(id),
  status            text not null default 'SCHEDULED'
                    check (status in ('SCHEDULED','ADMINISTERED','HELD','REFUSED','MISSED')),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_mar_adm on public.mar_records(admission_id);
create index idx_mar_time on public.mar_records(tenant_id, scheduled_at);
create trigger trg_mar_updated before update on public.mar_records
  for each row execute function public.set_updated_at();

-- ---------- RLS ----------
do $$
declare t text;
begin
  foreach t in array array[
    'locations','admissions','bed_transfers','nursing_notes','doctor_rounds','mar_records'
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

-- ---------- RPC: admit patient ----------
create or replace function public.admit_patient(
  p_tenant_id       uuid,
  p_branch_id       uuid,
  p_patient_id      uuid,
  p_bed_id          uuid,
  p_doctor_id       uuid,
  p_reason          text,
  p_diagnosis       text,
  p_expected_discharge date,
  p_user_id         uuid
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_adm_id  uuid;
  v_bed_ok  boolean;
begin
  select exists(
    select 1 from public.locations
    where id = p_bed_id and tenant_id = p_tenant_id and type = 'BED' and is_active = true
  ) into v_bed_ok;
  if not v_bed_ok then raise exception 'Bed not found or inactive'; end if;

  if exists (select 1 from public.admissions where bed_id = p_bed_id and status = 'ADMITTED') then
    raise exception 'Bed is already occupied';
  end if;

  if exists (select 1 from public.admissions where patient_id = p_patient_id and status = 'ADMITTED') then
    raise exception 'Patient already has an active admission';
  end if;

  insert into public.admissions
    (tenant_id, branch_id, patient_id, bed_id, admitting_doctor, reason, diagnosis,
     expected_discharge, status, created_by)
  values
    (p_tenant_id, p_branch_id, p_patient_id, p_bed_id, p_doctor_id, p_reason, p_diagnosis,
     p_expected_discharge, 'ADMITTED', p_user_id)
  returning id into v_adm_id;

  return jsonb_build_object('admissionId', v_adm_id);
end;
$$;
grant execute on function public.admit_patient to authenticated;

-- ---------- RPC: transfer bed ----------
create or replace function public.transfer_bed(
  p_tenant_id     uuid,
  p_admission_id  uuid,
  p_to_bed_id     uuid,
  p_reason        text,
  p_user_id       uuid
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_from_bed uuid;
  v_status   text;
begin
  select bed_id, status into v_from_bed, v_status
  from public.admissions
  where id = p_admission_id and tenant_id = p_tenant_id;

  if v_from_bed is null then raise exception 'Admission not found'; end if;
  if v_status <> 'ADMITTED' then raise exception 'Cannot transfer admission in status %', v_status; end if;

  if exists (select 1 from public.admissions where bed_id = p_to_bed_id and status = 'ADMITTED') then
    raise exception 'Target bed is occupied';
  end if;

  insert into public.bed_transfers
    (tenant_id, admission_id, from_bed_id, to_bed_id, reason, transferred_by)
  values
    (p_tenant_id, p_admission_id, v_from_bed, p_to_bed_id, p_reason, p_user_id);

  update public.admissions
  set bed_id = p_to_bed_id, updated_at = now()
  where id = p_admission_id;

  return p_admission_id;
end;
$$;
grant execute on function public.transfer_bed to authenticated;

-- ---------- RPC: discharge ----------
create or replace function public.discharge_patient(
  p_tenant_id         uuid,
  p_admission_id      uuid,
  p_discharge_type    text,
  p_discharge_summary text,
  p_user_id           uuid
)
returns uuid
language plpgsql security definer set search_path = public
as $$
begin
  update public.admissions
  set status = 'DISCHARGED',
      discharged_at = now(),
      discharge_type = p_discharge_type,
      discharge_summary = p_discharge_summary,
      updated_at = now()
  where id = p_admission_id and tenant_id = p_tenant_id and status = 'ADMITTED';

  if not found then raise exception 'Admission not found or already discharged'; end if;

  return p_admission_id;
end;
$$;
grant execute on function public.discharge_patient to authenticated;

-- ---------- View: bed status (derived) ----------
create or replace view public.v_beds_with_status as
select
  l.id          as bed_id,
  l.tenant_id,
  l.branch_id,
  l.name        as bed_name,
  l.code        as bed_code,
  l.is_active,
  p.id          as room_id,
  p.name        as room_name,
  w.id          as ward_id,
  w.name        as ward_name,
  case
    when not l.is_active then 'INACTIVE'
    when exists (select 1 from public.admissions a where a.bed_id = l.id and a.status = 'ADMITTED') then 'OCCUPIED'
    else 'AVAILABLE'
  end as bed_status,
  (select a.id from public.admissions a where a.bed_id = l.id and a.status = 'ADMITTED' limit 1) as current_admission_id,
  (select a.patient_id from public.admissions a where a.bed_id = l.id and a.status = 'ADMITTED' limit 1) as current_patient_id
from public.locations l
left join public.locations p on p.id = l.parent_id and p.type = 'ROOM'
left join public.locations w on w.id = p.parent_id and w.type = 'WARD'
where l.type = 'BED';

alter view public.v_beds_with_status set (security_invoker = true);