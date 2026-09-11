-- ============================================================
-- 0004_provisioning.sql
-- Atomic tenant provisioning — called ONLY after a verified
-- Razorpay webhook confirms subscription payment.
-- ============================================================

create or replace function public.provision_tenant(
  p_auth_user_id  uuid,
  p_email         text,
  p_full_name     text,
  p_tenant_name   text,
  p_tenant_slug   text,
  p_tenant_type   text,
  p_plan_id       uuid,
  p_sub_starts    timestamptz,
  p_sub_ends      timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id  uuid;
  v_org_id     uuid;
  v_branch_id  uuid;
  v_sub_id     uuid;
  v_admin_role uuid;
begin
  insert into public.tenants (name, slug, type, status, contact_email)
  values (p_tenant_name, p_tenant_slug, p_tenant_type, 'ACTIVE', p_email)
  returning id into v_tenant_id;

  insert into public.subscriptions (tenant_id, plan_id, status, starts_at, ends_at)
  values (v_tenant_id, p_plan_id, 'ACTIVE', p_sub_starts, p_sub_ends)
  returning id into v_sub_id;

  insert into public.organizations (tenant_id, name, type, email)
  values (v_tenant_id, p_tenant_name, p_tenant_type, p_email)
  returning id into v_org_id;

  insert into public.branches (tenant_id, organization_id, name, city)
  values (v_tenant_id, v_org_id, 'Main Branch', '')
  returning id into v_branch_id;

  insert into public.users (id, email, full_name, is_platform_admin)
  values (p_auth_user_id, p_email, p_full_name, false)
  on conflict (id) do update set email = excluded.email, full_name = excluded.full_name;

  insert into public.roles (tenant_id, code, name, permissions, is_system)
  values
    (v_tenant_id, 'HOSPITAL_ADMIN',  'Hospital Admin',  '[]'::jsonb, true),
    (v_tenant_id, 'DOCTOR',          'Doctor',          '[]'::jsonb, true),
    (v_tenant_id, 'NURSE',           'Nurse',           '[]'::jsonb, true),
    (v_tenant_id, 'RECEPTIONIST',    'Receptionist',    '[]'::jsonb, true),
    (v_tenant_id, 'PHARMACIST',      'Pharmacist',      '[]'::jsonb, true),
    (v_tenant_id, 'LAB_TECHNICIAN',  'Lab Technician',  '[]'::jsonb, true),
    (v_tenant_id, 'ACCOUNTANT',      'Accountant',      '[]'::jsonb, true);

  select id into v_admin_role
  from public.roles where tenant_id = v_tenant_id and code = 'HOSPITAL_ADMIN';

  insert into public.memberships (tenant_id, user_id, role_id, branch_id, is_active)
  values (v_tenant_id, p_auth_user_id, v_admin_role, null, true);

  insert into public.platform_audit_logs (actor_user_id, action, entity, entity_id, after_state)
  values (p_auth_user_id, 'TENANT_PROVISIONED', 'tenants', v_tenant_id,
          jsonb_build_object('tenant', p_tenant_name, 'plan_id', p_plan_id));

  return jsonb_build_object(
    'tenant_id',    v_tenant_id,
    'org_id',       v_org_id,
    'branch_id',    v_branch_id,
    'subscription', v_sub_id
  );
end;
$$;
