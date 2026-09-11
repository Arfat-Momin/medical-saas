-- ============================================================
-- 0001_foundation.sql
-- Extensions, helper functions, updated_at trigger
-- ============================================================

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.jwt_tenant_id()
returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'tenant_id', '')::uuid;
$$;

create or replace function public.is_platform_admin()
returns boolean language sql stable as $$
  select coalesce((auth.jwt() ->> 'is_platform_admin')::boolean, false);
$$;
