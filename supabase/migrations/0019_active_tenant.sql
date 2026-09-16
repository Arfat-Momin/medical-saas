-- ============================================================
-- 0019_active_tenant.sql
-- Lets a multi-tenant user pick which tenant their JWT is scoped to.
-- ============================================================

alter table public.users
  add column if not exists active_tenant_id uuid references public.tenants(id) on delete set null;

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  claims              jsonb;
  v_user_id           uuid;
  v_tenant_id         uuid;
  v_is_platform_admin boolean;
begin
  claims := event -> 'claims';
  v_user_id := (event ->> 'user_id')::uuid;

  select u.is_platform_admin, u.active_tenant_id
    into v_is_platform_admin, v_tenant_id
  from public.users u
  where u.id = v_user_id;

  if v_tenant_id is not null then
    if not exists (
      select 1 from public.memberships m
      where m.user_id = v_user_id and m.tenant_id = v_tenant_id and m.is_active = true
    ) then
      v_tenant_id := null;
    end if;
  end if;

  if v_tenant_id is null then
    select m.tenant_id into v_tenant_id
    from public.memberships m
    where m.user_id = v_user_id and m.is_active = true
    order by m.created_at asc
    limit 1;
  end if;

  claims := jsonb_set(claims, '{is_platform_admin}',
                      to_jsonb(coalesce(v_is_platform_admin, false)));

  if v_tenant_id is not null then
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(v_tenant_id));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant select on public.users to supabase_auth_admin;
grant select on public.memberships to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;