-- Migration 0032_attachment_metadata.sql
-- Extend encounter_attachments with patient_id, doctor_id, capture_mode, document_type
ALTER TABLE public.encounter_attachments
  ADD COLUMN IF NOT EXISTS patient_id    uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS doctor_id     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS capture_mode  text CHECK (capture_mode IN ('CAMERA','UPLOAD')),
  ADD COLUMN IF NOT EXISTS document_type text CHECK (document_type IN
    ('PRESCRIPTION','REPORT','XRAY','ECG','CONSENT','OTHER'));

CREATE INDEX IF NOT EXISTS idx_enc_attachments_patient ON public.encounter_attachments(patient_id);
CREATE INDEX IF NOT EXISTS idx_enc_attachments_doctor  ON public.encounter_attachments(doctor_id);
