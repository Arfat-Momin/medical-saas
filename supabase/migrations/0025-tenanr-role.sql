-- ============================================================
-- 1. GLOBAL DATA REPAIR (Existing Tenants) - JSONB VERSION
-- ============================================================

-- Ensure at least one plan exists
INSERT INTO plans (code, name, price_paise, billing_cycle, max_branches, max_users, is_active)
SELECT 'BASIC', 'Basic Plan', 99900, 'MONTHLY', 3, 20, true
WHERE NOT EXISTS (SELECT 1 FROM plans);

-- Fix missing plan_id in subscriptions (assigns the cheapest active plan)
UPDATE subscriptions
SET plan_id = (SELECT id FROM plans WHERE is_active = true ORDER BY price_paise ASC LIMIT 1)
WHERE plan_id IS NULL;

-- Fix status mismatch (If tenant is ACTIVE, make subscription ACTIVE)
UPDATE subscriptions s
SET status = 'ACTIVE'
FROM tenants t
WHERE s.tenant_id = t.id
  AND t.status = 'ACTIVE'
  AND s.status NOT IN ('ACTIVE', 'TRIAL', 'GRACE');

-- Insert missing subscriptions for active tenants
INSERT INTO subscriptions (tenant_id, plan_id, status, starts_at, ends_at)
SELECT 
    t.id, 
    (SELECT id FROM plans WHERE is_active = true LIMIT 1), 
    'ACTIVE', 
    now(), 
    now() + interval '1 year'
FROM tenants t
WHERE t.status = 'ACTIVE'
  AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.tenant_id = t.id);

-- Backfill Role Permissions for ALL existing tenants using JSONB syntax
UPDATE roles SET permissions = '["org:manage", "branch:manage", "department:manage", "user:manage", "role:manage", "patient:read", "patient:create", "patient:update", "appointment:read", "appointment:manage", "consultation:read", "consultation:write", "ipd:read", "ipd:manage", "mar:write", "pharmacy:read", "pharmacy:dispense", "pharmacy:stock", "lab:read", "lab:order", "lab:result:enter", "lab:result:verify", "billing:read", "billing:manage", "billing:refund"]'::jsonb WHERE code = 'HOSPITAL_ADMIN' AND (permissions IS NULL OR permissions = '[]'::jsonb);
UPDATE roles SET permissions = '["patient:read", "patient:update", "appointment:read", "appointment:manage", "consultation:read", "consultation:write", "ipd:read", "ipd:manage", "mar:write", "lab:read", "lab:order", "pharmacy:read"]'::jsonb WHERE code = 'DOCTOR' AND (permissions IS NULL OR permissions = '[]'::jsonb);
UPDATE roles SET permissions = '["patient:read", "appointment:read", "consultation:read", "ipd:read", "ipd:manage", "mar:write", "lab:read"]'::jsonb WHERE code = 'NURSE' AND (permissions IS NULL OR permissions = '[]'::jsonb);
UPDATE roles SET permissions = '["patient:read", "patient:create", "patient:update", "appointment:read", "appointment:manage", "billing:read"]'::jsonb WHERE code = 'RECEPTIONIST' AND (permissions IS NULL OR permissions = '[]'::jsonb);
UPDATE roles SET permissions = '["patient:read", "pharmacy:read", "pharmacy:dispense", "pharmacy:stock", "billing:read"]'::jsonb WHERE code = 'PHARMACIST' AND (permissions IS NULL OR permissions = '[]'::jsonb);
UPDATE roles SET permissions = '["patient:read", "lab:read", "lab:order", "lab:result:enter", "lab:result:verify"]'::jsonb WHERE code = 'LAB_TECHNICIAN' AND (permissions IS NULL OR permissions = '[]'::jsonb);
UPDATE roles SET permissions = '["patient:read", "appointment:read", "consultation:read", "ipd:read", "pharmacy:read", "lab:read", "billing:read", "billing:manage", "billing:refund"]'::jsonb WHERE code = 'ACCOUNTANT' AND (permissions IS NULL OR permissions = '[]'::jsonb);


-- ============================================================
-- 2. FUTURE-PROOFING (New Tenants) - JSONB VERSION
-- ============================================================

-- Trigger 1: Auto-create a Trial Subscription when a new Tenant is created
CREATE OR REPLACE FUNCTION public.handle_new_tenant()
RETURNS TRIGGER AS $$
DECLARE
  default_plan_id UUID;
BEGIN
  SELECT id INTO default_plan_id FROM public.plans WHERE is_active = true ORDER BY price_paise ASC LIMIT 1;
  IF default_plan_id IS NOT NULL THEN
    INSERT INTO public.subscriptions (tenant_id, plan_id, status, starts_at, ends_at)
    VALUES (NEW.id, default_plan_id, 'TRIAL', now(), now() + interval '14 days');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_tenant_created ON public.tenants;
CREATE TRIGGER on_tenant_created
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_tenant();

-- Trigger 2: Auto-seed Roles and Permissions when a new Tenant is created (using JSONB)
CREATE OR REPLACE FUNCTION public.seed_tenant_roles()
RETURNS TRIGGER AS $$
BEGIN
  -- HOSPITAL_ADMIN
  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE tenant_id = NEW.id AND code = 'HOSPITAL_ADMIN') THEN
    INSERT INTO public.roles (tenant_id, code, name, permissions, is_system)
    VALUES (NEW.id, 'HOSPITAL_ADMIN', 'Hospital Admin', '["org:manage", "branch:manage", "department:manage", "user:manage", "role:manage", "patient:read", "patient:create", "patient:update", "appointment:read", "appointment:manage", "consultation:read", "consultation:write", "ipd:read", "ipd:manage", "mar:write", "pharmacy:read", "pharmacy:dispense", "pharmacy:stock", "lab:read", "lab:order", "lab:result:enter", "lab:result:verify", "billing:read", "billing:manage", "billing:refund"]'::jsonb, true);
  END IF;
  -- DOCTOR
  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE tenant_id = NEW.id AND code = 'DOCTOR') THEN
    INSERT INTO public.roles (tenant_id, code, name, permissions, is_system)
    VALUES (NEW.id, 'DOCTOR', 'Doctor', '["patient:read", "patient:update", "appointment:read", "appointment:manage", "consultation:read", "consultation:write", "ipd:read", "ipd:manage", "mar:write", "lab:read", "lab:order", "pharmacy:read"]'::jsonb, true);
  END IF;
  -- NURSE
  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE tenant_id = NEW.id AND code = 'NURSE') THEN
    INSERT INTO public.roles (tenant_id, code, name, permissions, is_system)
    VALUES (NEW.id, 'NURSE', 'Nurse', '["patient:read", "appointment:read", "consultation:read", "ipd:read", "ipd:manage", "mar:write", "lab:read"]'::jsonb, true);
  END IF;
  -- RECEPTIONIST
  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE tenant_id = NEW.id AND code = 'RECEPTIONIST') THEN
    INSERT INTO public.roles (tenant_id, code, name, permissions, is_system)
    VALUES (NEW.id, 'RECEPTIONIST', 'Receptionist', '["patient:read", "patient:create", "patient:update", "appointment:read", "appointment:manage", "billing:read"]'::jsonb, true);
  END IF;
  -- PHARMACIST
  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE tenant_id = NEW.id AND code = 'PHARMACIST') THEN
    INSERT INTO public.roles (tenant_id, code, name, permissions, is_system)
    VALUES (NEW.id, 'PHARMACIST', 'Pharmacist', '["patient:read", "pharmacy:read", "pharmacy:dispense", "pharmacy:stock", "billing:read"]'::jsonb, true);
  END IF;
  -- LAB_TECHNICIAN
  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE tenant_id = NEW.id AND code = 'LAB_TECHNICIAN') THEN
    INSERT INTO public.roles (tenant_id, code, name, permissions, is_system)
    VALUES (NEW.id, 'LAB_TECHNICIAN', 'Lab Technician', '["patient:read", "lab:read", "lab:order", "lab:result:enter", "lab:result:verify"]'::jsonb, true);
  END IF;
  -- ACCOUNTANT
  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE tenant_id = NEW.id AND code = 'ACCOUNTANT') THEN
    INSERT INTO public.roles (tenant_id, code, name, permissions, is_system)
    VALUES (NEW.id, 'ACCOUNTANT', 'Accountant', '["patient:read", "appointment:read", "consultation:read", "ipd:read", "pharmacy:read", "lab:read", "billing:read", "billing:manage", "billing:refund"]'::jsonb, true);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_tenant_created_roles ON public.tenants;
CREATE TRIGGER on_tenant_created_roles
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_tenant_roles();

$fullPath = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) "GLOBAL_TENANT_FIX.sql"))
[System.IO.File]::WriteAllText($fullPath, $sqlContent, [System.Text.UTF8Encoding]::new($false))
Write-Host "Created GLOBAL_TENANT_FIX.sql with JSONB support." -ForegroundColor Green
Write-Host "Opening the file so you can copy the SQL..." -ForegroundColor Cyan
Start-Process notepad.exe $fullPath