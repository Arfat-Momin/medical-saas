-- Migration 0033_finance_permissions.sql
-- Backfill finance:read and finance:manage permissions for existing HOSPITAL_ADMIN and ACCOUNTANT roles.
-- Safe to re-run (uses jsonb array union, not replace).

UPDATE public.roles
SET permissions = (
  SELECT jsonb_agg(DISTINCT p)
  FROM jsonb_array_elements_text(
    COALESCE(permissions, '[]'::jsonb)
    || '["finance:read","finance:manage"]'::jsonb
  ) AS p
)
WHERE code IN ('HOSPITAL_ADMIN', 'ACCOUNTANT');
