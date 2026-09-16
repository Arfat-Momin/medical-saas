-- ============================================================
-- 0020_atomic_save_encounter.sql
-- Fold header-field + status updates into save_encounter so the
-- whole consultation (vitals, diagnoses, prescription, lab tests,
-- header, status) commits in ONE transaction.
-- ============================================================

drop function if exists public.save_encounter(uuid, uuid, jsonb, jsonb, jsonb, jsonb);

create or replace function public.save_encounter(
  p_encounter_id  uuid,
  p_tenant_id     uuid,
  p_vitals        jsonb,
  p_diagnoses     jsonb,
  p_prescription  jsonb,
  p_lab_tests     jsonb,
  p_header        jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_presc_id uuid;
begin
  -- sanity: encounter must belong to tenant
  if not exists (
    select 1 from public.encounters
    where id = p_encounter_id and tenant_id = p_tenant_id
  ) then
    raise exception 'Encounter % not found in tenant %', p_encounter_id, p_tenant_id;
  end if;

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

  if p_diagnoses is not null then
    delete from public.diagnoses where encounter_id = p_encounter_id;
    insert into public.diagnoses (tenant_id, encounter_id, diagnosis_text, icd_code, notes, is_primary)
    select p_tenant_id, p_encounter_id,
           item->>'diagnosisText',
           nullif(item->>'icdCode',''),
           nullif(item->>'notes',''),
           coalesce((item->>'isPrimary')::boolean, false)
    from jsonb_array_elements(p_diagnoses) as item
    where coalesce(item->>'diagnosisText','') <> '';
  end if;

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
    select p_tenant_id, v_presc_id,
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

  if p_lab_tests is not null then
    update public.encounters
    set lab_tests_json = p_lab_tests
    where id = p_encounter_id;
  end if;

  -- Header fields + status in same tx
  if p_header is not null then
    update public.encounters
    set chief_complaint = case when p_header ? 'chiefComplaint' then nullif(p_header->>'chiefComplaint','') else chief_complaint end,
        history         = case when p_header ? 'history'        then nullif(p_header->>'history','')        else history         end,
        examination     = case when p_header ? 'examination'    then nullif(p_header->>'examination','')    else examination     end,
        notes           = case when p_header ? 'notes'          then nullif(p_header->>'notes','')          else notes           end,
        status          = case when p_header ? 'complete' and (p_header->>'complete')::boolean
                               then 'COMPLETED' else status end,
        updated_at      = now()
    where id = p_encounter_id and tenant_id = p_tenant_id;
  end if;

  return p_encounter_id;
end;
$$;

grant execute on function public.save_encounter(uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;