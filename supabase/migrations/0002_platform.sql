-- ============================================================
-- 0002_platform.sql
-- Platform-level tables (Super Admin scope)
-- ============================================================

create table public.plans (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  name           text not null,
  price_paise    integer not null check (price_paise >= 0),
  billing_cycle  text not null check (billing_cycle in ('MONTHLY','YEARLY')),
  max_branches   integer not null default 1,
  max_users      integer not null default 5,
  features       jsonb not null default '{}'::jsonb,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger trg_plans_updated before update on public.plans
  for each row execute function public.set_updated_at();

create sequence public.tenant_code_seq start 1;

create table public.tenants (
  id            uuid primary key default gen_random_uuid(),
  tenant_code   text not null unique
                default ('TENANT' || lpad(nextval('public.tenant_code_seq')::text, 3, '0')),
  name          text not null,
  slug          text not null unique,
  type          text not null check (type in ('CLINIC','HOSPITAL')),
  status        text not null default 'TRIAL'
                check (status in ('TRIAL','ACTIVE','GRACE','SUSPENDED','CANCELLED')),
  contact_email text,
  contact_phone text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_tenants_updated before update on public.tenants
  for each row execute function public.set_updated_at();

create table public.subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references public.tenants(id) on delete cascade,
  plan_id                   uuid not null references public.plans(id),
  status                    text not null default 'PENDING'
                            check (status in ('PENDING','ACTIVE','GRACE','SUSPENDED','CANCELLED')),
  starts_at                 timestamptz not null default now(),
  ends_at                   timestamptz not null,
  razorpay_subscription_id  text unique,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index idx_subscriptions_tenant on public.subscriptions(tenant_id);
create index idx_subscriptions_status_ends on public.subscriptions(status, ends_at);
create trigger trg_subscriptions_updated before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.subscription_payments (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  subscription_id      uuid references public.subscriptions(id) on delete set null,
  razorpay_order_id    text,
  razorpay_payment_id  text unique,
  amount_paise         integer not null,
  currency             text not null default 'INR',
  status               text not null default 'CREATED'
                       check (status in ('CREATED','AUTHORIZED','CAPTURED','FAILED','REFUNDED')),
  raw_payload          jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now()
);
create index idx_subpay_tenant on public.subscription_payments(tenant_id);

create table public.platform_audit_logs (
  id             uuid primary key default gen_random_uuid(),
  actor_user_id  uuid,
  action         text not null,
  entity         text not null,
  entity_id      uuid,
  before_state   jsonb,
  after_state    jsonb,
  created_at     timestamptz not null default now()
);
create index idx_platform_audit_entity on public.platform_audit_logs(entity, entity_id);
