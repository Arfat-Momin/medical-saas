-- ============================================================
-- 0008_module4_appointments_opd.sql
-- Appointments, encounters, vitals, diagnoses, prescriptions
-- ============================================================

-- ---------- Appointments ----------
create table public.appointments (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  branch_id        uuid not null references public.branches(id) on delete restrict,
  patient_id       uuid not null references public.patients(id) on delete restrict,
  doctor_id        uuid not null references public.users(id) on delete restrict,
  appointment_date date not null,
  slot_time        time,
  queue_token      integer,
  status           text not null default 'SCHEDULED'
                   check (status in ('SCHEDULED','CHECKED_IN','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW')),
  chief_complaint  text,
  notes            text,
  created_by       uuid references public.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_appt_tenant_date   on public.appointments(tenant_id, appointment_date);
create index idx_appt_doctor_date   on public.appointments(tenant_id, doctor_id, appointment_date);
create index idx_appt_patient       on public.appointments(tenant_id, patient_id);
create index idx_appt_status        on public.appointments(tenant_id, status);

create trigger trg_appt_updated before update on public.appointments
  for each row execute function public.set_updated_at();

-- ---------- Daily queue counters (atomic token allocation) ----------
create table public.queue_counters (
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  branch_id   uuid not null references public.branches(id) on delete cascade,
  doctor_id   uuid not null references public.users(id) on delete cascade,
  queue_date  date not null,
  last_value  integer not null default 0,
  primary key (tenant_id, branch_id, doctor_id, queue_date)
);

create or replace function public.next_queue_token(
  p_tenant uuid, p_branch uuid, p_doctor uuid, p_date date
) returns integer language plpgsql as $$
declare v_next integer;
begin
  insert into public.queue_counters (tenant_id, branch_id, doctor_id, queue_date, last_value)
  values (p_tenant, p_branch, p_doctor, p_date, 1)
  on conflict (tenant_id, branch_id, doctor_id, queue_date)
  do update set last_value = public.queue_counters.last_value + 1
  returning last_value into v_next;
  return v_next;
end;
$$;

-- ---------- Encounters (OPD consultations) ----------
create table public.encounters (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  branch_id        uuid not null references public.branches(id) on delete restrict,
  patient_id       uuid not null references public.patients(id) on delete restrict,
  doctor_id        uuid not null references public.users(id) on delete restrict,
  appointment_id   uuid references public.appointments(id) on delete set null,
  encounter_type   text not null default 'OPD' check (encounter_type in ('OPD','IPD','EMERGENCY')),
  encounter_date   date not null default current_date,
  status           text not null default 'DRAFT' check (status in ('DRAFT','COMPLETED','AMENDED')),
  chief_complaint  text,
  history          text,
  examination      text,
  notes            text,
  created_by       uuid references public.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_enc_tenant       on public.encounters(tenant_id);
create index idx_enc_patient      on public.encounters(tenant_id, patient_id);
create index idx_enc_doctor_date  on public.encounters(tenant_id, doctor_id, encounter_date);
create index idx_enc_date         on public.encounters(tenant_id, encounter_date);

create trigger trg_enc_updated before update on public.encounters
  for each row execute function public.set_updated_at();

-- ---------- Vitals (one per encounter) ----------
create table public.vitals (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  encounter_id    uuid not null references public.encounters(id) on delete cascade,
  temperature_c   numeric(4,1),
  bp_systolic     integer,
  bp_diastolic    integer,
  pulse           integer,
  resp_rate       integer,
  spo2            integer,
  weight_kg       numeric(5,2),
  height_cm       numeric(5,2),
  bmi             numeric(5,2),
  recorded_by     uuid references public.users(id),
  recorded_at     timestamptz not null default now(),
  unique (encounter_id)
);

-- ---------- Diagnoses (many per encounter) ----------
create table public.diagnoses (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  encounter_id    uuid not null references public.encounters(id) on delete cascade,
  diagnosis_text  text not null,
  icd_code        text,
  notes           text,
  is_primary      boolean not null default false,
  created_at      timestamptz not null default now()
);

create index idx_diag_enc on public.diagnoses(encounter_id);

-- ---------- Prescriptions (header + items) ----------
create table public.prescriptions (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  encounter_id  uuid not null references public.encounters(id) on delete cascade,
  notes         text,
  created_at    timestamptz not null default now(),
  unique (encounter_id)
);

create table public.prescription_items (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  prescription_id  uuid not null references public.prescriptions(id) on delete cascade,
  medicine_name    text not null,
  dosage           text,
  frequency        text,
  duration         text,
  route            text,
  instructions     text,
  quantity         integer,
  created_at       timestamptz not null default now()
);

create index idx_presc_items on public.prescription_items(prescription_id);

-- ---------- RLS ----------
do $$
declare t text;
begin
  foreach t in array array[
    'appointments','queue_counters','encounters',
    'vitals','diagnoses','prescriptions','prescription_items'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'appointments','encounters','vitals','diagnoses',
    'prescriptions','prescription_items'
  ]
  loop
    execute format($f$
      create policy %1$s_tenant_isolation on public.%1$I
        for all
        using (tenant_id = public.jwt_tenant_id())
        with check (tenant_id = public.jwt_tenant_id());
    $f$, t);
  end loop;
end $$;

-- queue_counters: read via RPC with SECURITY DEFINER (no direct RLS policy)
create policy queue_counters_tenant on public.queue_counters
  for all
  using (tenant_id = public.jwt_tenant_id())
  with check (tenant_id = public.jwt_tenant_id());

-- ---------- Atomic encounter save (vitals + diagnoses + prescriptions) ----------
create or replace function public.save_encounter(
  p_encounter_id  uuid,
  p_tenant_id     uuid,
  p_vitals        jsonb,
  p_diagnoses     jsonb,
  p_prescription  jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_presc_id uuid;
begin
  -- Vitals (upsert, unique on encounter_id)
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

  -- Diagnoses: replace whole list
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

  -- Prescription: upsert header, replace items
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

  return p_encounter_id;
end;
$$;

grant execute on function public.save_encounter to authenticated;