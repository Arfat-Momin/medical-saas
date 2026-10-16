-- Migration for custom plans

ALTER TABLE public.plans ADD COLUMN is_custom boolean not null default false;
ALTER TABLE public.plans ADD COLUMN custom_tenant_id uuid references public.tenants(id) on delete cascade;

-- Allow 'CUSTOM' billing cycle
ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_billing_cycle_check;
ALTER TABLE public.plans ADD CONSTRAINT plans_billing_cycle_check CHECK (billing_cycle in ('MONTHLY','YEARLY','CUSTOM'));

ALTER TABLE public.plans ADD COLUMN custom_tenure_days integer;
