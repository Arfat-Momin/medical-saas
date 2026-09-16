-- ============================================================
-- 0015_module_mobile_sync.sql
-- Device registration + idempotency tracking for mobile sync.
-- ============================================================

-- ---------- Devices ----------
create table if not exists public.devices (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid references public.tenants(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  device_id       text not null,
  platform        text not null check (platform in ('ios','android','web')),
  app_version     text,
  os_version      text,
  push_token      text,
  last_seen_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (user_id, device_id)
);
create index if not exists idx_devices_tenant on public.devices(tenant_id);
create index if not exists idx_devices_user   on public.devices(user_id);

alter table public.devices enable row level security;
create policy devices_tenant_isolation on public.devices
  for all
  using (tenant_id = public.jwt_tenant_id() or user_id = auth.uid())
  with check (tenant_id = public.jwt_tenant_id() or user_id = auth.uid());

-- ---------- Sync operations (idempotency ledger) ----------
create table if not exists public.sync_operations (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  user_id           uuid not null references public.users(id) on delete cascade,
  device_id         text not null,
  idempotency_key   text not null,
  entity            text not null,
  operation         text not null,
  response_status   integer not null,
  response_body     jsonb not null,
  created_at        timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);
create index if not exists idx_sync_ops_key on public.sync_operations(tenant_id, idempotency_key);

alter table public.sync_operations enable row level security;
create policy sync_ops_tenant_isolation on public.sync_operations
  for all
  using (tenant_id = public.jwt_tenant_id())
  with check (tenant_id = public.jwt_tenant_id());
