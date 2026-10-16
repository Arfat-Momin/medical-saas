-- ============================================================
-- 0029_admission_consent.sql
-- IPD Admission Consent
-- ============================================================

ALTER TABLE public.admissions
  ADD COLUMN IF NOT EXISTS consent_signature text,
  ADD COLUMN IF NOT EXISTS consent_signed_at timestamptz;
