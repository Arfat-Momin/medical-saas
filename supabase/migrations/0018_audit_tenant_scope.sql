-- ============================================================
-- 0018_audit_tenant_scope.sql
-- Add tenant_id to platform_audit_logs so hospital-level audit
-- entries are scoped. RLS: platform admins see all; tenant
-- members see their own.
-- ============================================================

alter table public.platform_audit_logs
  add column if not exists tenant_id uuid references public.tenants(id) on delete set null;

create index if not exists idx_platform_audit_tenant
  on public.platform_audit_logs(tenant_id, created_at desc);

drop policy if exists platform_audit_platform_admin_all on public.platform_audit_logs;
drop policy if exists platform_audit_admin_all            on public.platform_audit_logs;
drop policy if exists platform_audit_tenant_read          on public.platform_audit_logs;

create policy platform_audit_admin_all on public.platform_audit_logs
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy platform_audit_tenant_read on public.platform_audit_logs
  for select
  using (tenant_id = public.jwt_tenant_id());