/**
 * IndexedDB schema for the web app.
 *
 * Mirrors the mobile SQLite schema so the two clients behave identically.
 * Every record carries:
 *   - local_id:      device-generated UUID (IndexedDB primary key)
 *   - server_id:     server-assigned UUID (null until first sync)
 *   - sync_status:   pending | synced | failed | conflict
 */

export const DB_NAME = 'medsaas';
export const SCHEMA_VERSION = 3;

export interface LocalPatient {
  local_id: string;
  server_id: string | null;
  tenant_id: string | null;
  branch_id: string | null;
  uhid: string | null;
  full_name: string;
  date_of_birth: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  mobile: string | null;
  address: string | null;
  blood_group: string | null;
  allergies: string | null;
  medical_history: string | null;
  emergency_contact: string | null;
  sync_status: 'pending' | 'synced' | 'failed' | 'conflict';
  sync_error: string | null;
  server_updated_at: string | null;
  created_at: string;
  updated_at: string;
  deleted: 0 | 1;
}

export interface LocalDoctor {
  local_id: string;
  server_id: string | null;
  full_name: string;
  email: string | null;
  role_code: string | null;
  is_active: 0 | 1;
  updated_at: string;
}

export interface LocalAppointment {
  local_id: string;
  server_id: string | null;
  tenant_id: string | null;
  branch_id: string | null;
  patient_local_id: string;
  patient_server_id: string | null;
  doctor_id: string | null;
  appointment_date: string;
  slot_time: string | null;
  queue_token: number | null;
  status: 'SCHEDULED' | 'CHECKED_IN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  chief_complaint: string | null;
  notes: string | null;
  sync_status: 'pending' | 'synced' | 'failed' | 'conflict';
  sync_error: string | null;
  server_updated_at: string | null;
  created_at: string;
  updated_at: string;
  deleted: 0 | 1;
}

export interface LocalEncounter {
  local_id: string;
  server_id: string | null;
  tenant_id: string | null;
  branch_id: string | null;
  patient_local_id: string;
  patient_server_id: string | null;
  doctor_id: string | null;
  appointment_local_id: string | null;
  appointment_server_id: string | null;
  encounter_date: string;
  status: 'DRAFT' | 'COMPLETED';
  chief_complaint: string | null;
  history: string | null;
  examination: string | null;
  notes: string | null;
  vitals: VitalsData | null;
  diagnoses: DiagnosisData[];
  prescription: PrescriptionData | null;
  labTests: LabTestData[];
  sync_status: 'pending' | 'synced' | 'failed' | 'conflict';
  sync_error: string | null;
  server_updated_at: string | null;
  created_at: string;
  updated_at: string;
  deleted: 0 | 1;
}

export interface VitalsData {
  temperatureC: string | null;
  bpSystolic: string | null;
  bpDiastolic: string | null;
  pulse: string | null;
  respRate: string | null;
  spo2: string | null;
  weightKg: string | null;
  heightCm: string | null;
}

export interface LabTestData {
  testId: string;
  testCode: string | null;
  testName: string;
  sampleType: string | null;
  price: number;
  referenceText: string | null;
}

export interface DiagnosisData {
  diagnosisText: string;
  icdCode: string | null;
  notes: string | null;
  isPrimary: boolean;
}

export interface PrescriptionData {
  notes: string | null;
  items: PrescriptionItemData[];
}

export interface PrescriptionItemData {
  medicineName: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  route: string | null;
  instructions: string | null;
  quantity: string | null;
}

export interface QueueItem {
  id: string;
  entity: string;
  operation: 'create' | 'update' | 'delete';
  local_id: string;
  payload: unknown;
  idempotency_key: string;
  device_id: string;
  client_timestamp: string;
  attempts: number;
  last_error: string | null;
  status: 'pending' | 'inflight' | 'failed' | 'conflict' | 'done';
  created_at: string;
}

export interface MetaItem {
  key: string;
  value: string;
}
