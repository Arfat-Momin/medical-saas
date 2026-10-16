-- ============================================================
-- Migration 0030: Ward category + IPD pricing catalog
-- Additive only — no existing columns/tables dropped
-- ============================================================

-- 1. Add ward_category, daily_rate, pricing_notes to locations
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS ward_category text CHECK (ward_category IN
    ('GENERAL','MALE','FEMALE','ICU','CABIN','PRIVATE','CUSTOM')),
  ADD COLUMN IF NOT EXISTS daily_rate    numeric(10,2),
  ADD COLUMN IF NOT EXISTS pricing_notes text;

-- 2. IPD service pricing catalog
CREATE TABLE IF NOT EXISTS public.ipd_pricing (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id   uuid        REFERENCES public.branches(id) ON DELETE CASCADE,
  category    text        NOT NULL CHECK (category IN
    ('WARD','ICU','CABIN','NURSING','SERVICE','PACKAGE','TAX')),
  name        text        NOT NULL,
  code        text,
  unit_price  numeric(10,2) NOT NULL DEFAULT 0,
  unit        text        NOT NULL DEFAULT 'per day',
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ipd_pricing_tenant ON public.ipd_pricing(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ipd_pricing_branch ON public.ipd_pricing(tenant_id, branch_id);

CREATE TRIGGER trg_ipd_pricing_updated
  BEFORE UPDATE ON public.ipd_pricing
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ipd_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY ipd_pricing_tenant ON public.ipd_pricing
  FOR ALL USING (tenant_id = public.jwt_tenant_id())
  WITH CHECK (tenant_id = public.jwt_tenant_id());
