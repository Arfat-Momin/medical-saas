-- ============================================================
-- 0006_fix_hook_security.sql
-- The custom access token hook queries public.users and
-- public.memberships, both of which have RLS enabled.
-- Without SECURITY DEFINER, the supabase_auth_admin role
-- hits "permission denied" and login fails with HTTP 500.
-- ============================================================

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  claims              jsonb;
  v_tenant_id         uuid;
  v_is_platform_admin boolean;
begin
  claims := event -> 'claims';

  select u.is_platform_admin into v_is_platform_admin
  from public.users u
  where u.id = (event ->> 'user_id')::uuid;

  select m.tenant_id into v_tenant_id
  from public.memberships m
  where m.user_id = (event ->> 'user_id')::uuid
    and m.is_active = true
  limit 1;

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