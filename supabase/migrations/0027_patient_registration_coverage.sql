-- ============================================================
-- 0027_patient_registration_coverage.sql
-- Add registration fee, coverage type, first visit details to patients
-- ============================================================

CREATE TYPE public.coverage_type AS ENUM (
  'NONE','GOVERNMENT_POLICY','MEDICLAIM_INSURANCE',
  'PACKAGE','SWASTHYA_SATHI','OTHER'
);

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS registration_amount   numeric(10,2),
  ADD COLUMN IF NOT EXISTS reg_payment_mode      text CHECK (reg_payment_mode IN ('CASH','CARD','UPI','CHEQUE','NEFT_RTGS')),
  ADD COLUMN IF NOT EXISTS reg_payment_date      timestamptz,
  ADD COLUMN IF NOT EXISTS reg_receipt_no        text,
  ADD COLUMN IF NOT EXISTS coverage_type         public.coverage_type NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS coverage_provider     text,
  ADD COLUMN IF NOT EXISTS policy_number         text,
  ADD COLUMN IF NOT EXISTS coverage_validity     date,
  ADD COLUMN IF NOT EXISTS coverage_notes        text,
  ADD COLUMN IF NOT EXISTS first_visit_reason    text,
  ADD COLUMN IF NOT EXISTS first_doctor_id       uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS first_department_id   uuid REFERENCES public.departments(id),
  ADD COLUMN IF NOT EXISTS first_visit_at        timestamptz DEFAULT now();
