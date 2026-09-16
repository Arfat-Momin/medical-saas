-- ============================================================
-- 0017_fix_routing_trigger.sql
-- Fix: route_encounter_completion() previously read a nonexistent
-- column `new.prescription_json`. Now it reads prescription items
-- from prescriptions + prescription_items, keyed by encounter_id.
-- ============================================================

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
  if new.status <> 'COMPLETED' then return new; end if;
  if old.status = 'COMPLETED' then return new; end if;

  v_branch_id := coalesce(
    new.branch_id,
    (select id from public.branches
     where tenant_id = new.tenant_id and is_active = true
     order by branch_code limit 1)
  );

  -- A. Route prescription -> pharmacy_queue
  select coalesce(jsonb_agg(jsonb_build_object(
    'medicineName', pi.medicine_name,
    'dosage',       pi.dosage,
    'frequency',    pi.frequency,
    'duration',     pi.duration,
    'route',        pi.route,
    'instructions', pi.instructions,
    'quantity',     pi.quantity
  )), '[]'::jsonb)
  into v_items
  from public.prescriptions p
  join public.prescription_items pi on pi.prescription_id = p.id
  where p.encounter_id = new.id;

  if jsonb_array_length(v_items) > 0 then
    if not exists (select 1 from public.pharmacy_queue where encounter_id = new.id) then
      insert into public.pharmacy_queue
        (tenant_id, branch_id, encounter_id, patient_id, doctor_id, items)
      values
        (new.tenant_id, v_branch_id, new.id, new.patient_id, new.doctor_id, v_items);
    end if;
  end if;

  -- B. Route lab tests -> lab_orders
  v_lab_tests := coalesce(new.lab_tests_json, '[]'::jsonb);
  if jsonb_array_length(v_lab_tests) > 0 then
    if not exists (select 1 from public.lab_orders where encounter_id = new.id) then
      insert into public.lab_orders
        (tenant_id, branch_id, patient_id, doctor_id, encounter_id,
         status, priority, notes, total_amount)
      values
        (new.tenant_id, v_branch_id, new.patient_id, new.doctor_id, new.id,
         'ORDERED', 'ROUTINE', 'Auto-ordered from consultation', 0)
      returning id into v_lab_order_id;

      for v_test in select * from jsonb_array_elements(v_lab_tests) loop
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