-- ============================================================
-- 0005_rls.sql
-- Row-Level Security + Super Admin isolation + Auth Hook
-- ============================================================

-- PLATFORM TABLES — only Super Admin
alter table public.plans                 enable row level security;
alter table public.tenants               enable row level security;
alter table public.subscriptions         enable row level security;
alter table public.subscription_payments enable row level security;
alter table public.platform_audit_logs   enable row level security;

create policy "plans_platform_admin_all" on public.plans
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "tenants_platform_admin_all" on public.tenants
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "subs_platform_admin_all" on public.subscriptions
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "subpay_platform_admin_all" on public.subscription_payments
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "platform_audit_platform_admin_all" on public.platform_audit_logs
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- HOSPITAL TABLES — tenant-scoped; Super Admin has NO policy here.
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','branches','departments','roles','memberships',
    'patients','uhid_counters','users'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

create policy "users_self_read" on public.users
  for select using (
    id = auth.uid()
    or exists (
      select 1 from public.memberships m
      where m.user_id = public.users.id
        and m.tenant_id = public.jwt_tenant_id()
    )
  );

create policy "users_self_update" on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array[
    'organizations','branches','departments','roles','memberships',
    'patients','uhid_counters'
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

-- Custom Access Token Hook — injects tenant_id + is_platform_admin into JWT.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
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

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
