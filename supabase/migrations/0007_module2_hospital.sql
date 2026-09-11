-- ============================================================
-- 0007_module2_hospital.sql
-- RPC for attaching a user to a tenant + fix membership uniqueness
-- with NULL branch_id (Postgres 15+ NULLS NOT DISTINCT)
-- ============================================================

-- Fix membership unique: NULL branch_id must be treated as equal
alter table public.memberships
  drop constraint if exists memberships_tenant_id_user_id_role_id_branch_id_key;

alter table public.memberships
  add constraint memberships_unique
  unique nulls not distinct (tenant_id, user_id, role_id, branch_id);

-- Atomic: validate role + branch belong to tenant, then upsert membership
create or replace function public.attach_user_to_tenant(
  p_user_id   uuid,
  p_tenant_id uuid,
  p_role_id   uuid,
  p_branch_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership_id uuid;
  v_role_code     text;
begin
  select code into v_role_code
  from public.roles
  where id = p_role_id and tenant_id = p_tenant_id;

  if v_role_code is null then
    raise exception 'Role % does not belong to tenant %', p_role_id, p_tenant_id;
  end if;

  if p_branch_id is not null then
    if not exists (
      select 1 from public.branches
      where id = p_branch_id and tenant_id = p_tenant_id
    ) then
      raise exception 'Branch % does not belong to tenant %', p_branch_id, p_tenant_id;
    end if;
  end if;

  insert into public.memberships (tenant_id, user_id, role_id, branch_id, is_active)
  values (p_tenant_id, p_user_id, p_role_id, p_branch_id, true)
  on conflict on constraint memberships_unique
  do update set is_active = true
  returning id into v_membership_id;

  return jsonb_build_object(
    'membership_id', v_membership_id,
    'role_code', v_role_code
  );
end;
$$;

grant execute on function public.attach_user_to_tenant to authenticated;