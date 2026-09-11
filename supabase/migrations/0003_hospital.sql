-- ============================================================
-- 0003_hospital.sql
-- Hospital-level tables (tenant-scoped)
-- ============================================================

create table public.users (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              text not null unique,
  full_name          text not null,
  phone              text,
  is_platform_admin  boolean not null default false,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger trg_users_updated before update on public.users
  for each row execute function public.set_updated_at();

create table public.organizations (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  name         text not null,
  legal_name   text,
  type         text not null check (type in ('CLINIC','HOSPITAL')),
  email        text, phone text, address text, city text, state text, pincode text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_org_tenant on public.organizations(tenant_id);
create trigger trg_org_updated before update on public.organizations
  for each row execute function public.set_updated_at();

create sequence public.branch_code_seq start 1;

create table public.branches (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  branch_code      text not null default ('BR' || lpad(nextval('public.branch_code_seq')::text,3,'0')),
  name             text not null,
  address          text, city text, state text, pincode text, phone text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (tenant_id, branch_code)
);
create index idx_branches_tenant on public.branches(tenant_id);
create trigger trg_branches_updated before update on public.branches
  for each row execute function public.set_updated_at();

create table public.departments (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  branch_id   uuid not null references public.branches(id) on delete cascade,
  name        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index idx_departments_tenant on public.departments(tenant_id);

create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  code        text not null,
  name        text not null,
  permissions jsonb not null default '[]'::jsonb,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (tenant_id, code)
);
create index idx_roles_tenant on public.roles(tenant_id);

create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  role_id     uuid not null references public.roles(id) on delete restrict,
  branch_id   uuid references public.branches(id) on delete set null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (tenant_id, user_id, role_id, branch_id)
);
create index idx_memberships_user on public.memberships(user_id);
create index idx_memberships_tenant on public.memberships(tenant_id);

create table public.uhid_counters (
  tenant_id  uuid primary key references public.tenants(id) on delete cascade,
  last_value bigint not null default 0
);

create or replace function public.next_uhid(p_tenant uuid)
returns text language plpgsql as $$
declare v_next bigint;
begin
  insert into public.uhid_counters (tenant_id, last_value)
  values (p_tenant, 1)
  on conflict (tenant_id)
  do update set last_value = public.uhid_counters.last_value + 1
  returning last_value into v_next;

  return 'PAT-' || lpad(v_next::text, 6, '0');
end;
$$;

create table public.patients (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  branch_id          uuid not null references public.branches(id) on delete restrict,
  uhid               text not null,
  full_name          text not null,
  date_of_birth      date,
  gender             text check (gender in ('MALE','FEMALE','OTHER')),
  mobile             text,
  address            text,
  blood_group        text,
  allergies          text,
  medical_history    text,
  emergency_contact  text,
  created_by         uuid references public.users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (tenant_id, uhid)
);
create index idx_patients_tenant on public.patients(tenant_id);
create index idx_patients_mobile on public.patients(tenant_id, mobile);
create index idx_patients_name on public.patients(tenant_id, full_name);
create trigger trg_patients_updated before update on public.patients
  for each row execute function public.set_updated_at();
