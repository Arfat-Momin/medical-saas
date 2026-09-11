-- ============================================================
-- 0014_module10_subscriptions.sql
-- Public signup flow + Razorpay order tracking + webhook
-- provisioning. Razorpay is for SUBSCRIPTIONS ONLY.
-- ============================================================

-- ---------- Pending signups ----------
create table public.pending_signups (
  id                  uuid primary key default gen_random_uuid(),
  auth_user_id        uuid not null,                          -- Supabase auth user id
  email               text not null,
  contact_name        text not null,
  contact_phone       text,
  hospital_name       text not null,
  hospital_slug       text not null unique,
  tenant_type         text not null check (tenant_type in ('CLINIC','HOSPITAL')),
  plan_id             uuid not null references public.plans(id),
  razorpay_order_id   text unique,
  razorpay_payment_id text,
  razorpay_signature  text,
  status              text not null default 'PENDING'
                      check (status in ('PENDING','PAID','FAILED','EXPIRED','PROVISIONED')),
  provisioned_tenant_id uuid references public.tenants(id) on delete set null,
  raw_webhook         jsonb,
  failure_reason      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  expires_at          timestamptz not null default (now() + interval '24 hours')
);
create index idx_pending_signups_email  on public.pending_signups(email);
create index idx_pending_signups_order  on public.pending_signups(razorpay_order_id);
create index idx_pending_signups_status on public.pending_signups(status);

create trigger trg_pending_signups_updated before update on public.pending_signups
  for each row execute function public.set_updated_at();

-- RLS: only service-role can touch this table (public signup + webhook use admin client)
alter table public.pending_signups enable row level security;

-- Super admin can view
create policy pending_signups_platform_admin_read on public.pending_signups
  for select using (public.is_platform_admin());

-- ---------- RPC: provision a tenant from a paid signup ----------
create or replace function public.provision_signup(
  p_signup_id  uuid,
  p_payment_id text,
  p_signature  text,
  p_webhook    jsonb
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_signup    record;
  v_tenant    jsonb;
  v_plan      record;
begin
  -- Row lock to prevent double-provisioning from webhook retries
  select * into v_signup
  from public.pending_signups
  where id = p_signup_id
  for update;

  if v_signup is null then
    raise exception 'Signup not found: %', p_signup_id;
  end if;

  -- Idempotent: if already provisioned, return existing
  if v_signup.status = 'PROVISIONED' and v_signup.provisioned_tenant_id is not null then
    return jsonb_build_object(
      'alreadyProvisioned', true,
      'tenantId', v_signup.provisioned_tenant_id
    );
  end if;

  -- Look up plan
  select * into v_plan from public.plans where id = v_signup.plan_id;
  if v_plan is null then raise exception 'Plan not found'; end if;

  -- Provision the tenant (existing RPC from migration 0004)
  v_tenant := public.provision_tenant(
    v_signup.auth_user_id,
    v_signup.email,
    v_signup.contact_name,
    v_signup.hospital_name,
    v_signup.hospital_slug,
    v_signup.tenant_type,
    v_signup.plan_id,
    now(),
    now() + case when v_plan.billing_cycle = 'MONTHLY' then interval '1 month' else interval '1 year' end
  );

  -- Record payment
  insert into public.subscription_payments
    (tenant_id, subscription_id, razorpay_order_id, razorpay_payment_id, amount_paise, status, raw_payload)
  values
    ((v_tenant->>'tenant_id')::uuid,
     (v_tenant->>'subscription')::uuid,
     v_signup.razorpay_order_id,
     p_payment_id,
     v_plan.price_paise,
     'CAPTURED',
     coalesce(p_webhook, '{}'::jsonb));

  -- Mark signup provisioned
  update public.pending_signups
  set status = 'PROVISIONED',
      razorpay_payment_id = p_payment_id,
      razorpay_signature  = p_signature,
      provisioned_tenant_id = (v_tenant->>'tenant_id')::uuid,
      raw_webhook = coalesce(p_webhook, '{}'::jsonb)
  where id = p_signup_id;

  return jsonb_build_object(
    'alreadyProvisioned', false,
    'tenantId', v_tenant->>'tenant_id',
    'orgId',    v_tenant->>'org_id',
    'branchId', v_tenant->>'branch_id',
    'subscriptionId', v_tenant->>'subscription'
  );
end;
$$;
grant execute on function public.provision_signup to authenticated, anon;