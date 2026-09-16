export const DB_NAME = 'medsaas';
export const SCHEMA_VERSION = 5;

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
  sync_status: 'pending' | 'synced' | 'failed' | 'conflict' | 'blocked';
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
  sync_status: 'pending' | 'synced' | 'failed' | 'conflict' | 'blocked';
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
  sync_status: 'pending' | 'synced' | 'failed' | 'conflict' | 'blocked';
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
  status: 'pending' | 'inflight' | 'failed' | 'conflict' | 'blocked' | 'done';
  next_retry_at: string | null;
  created_at: string;
}

export interface MetaItem {
  key: string;
  value: string;
}

// ─────────────────────────────────────────────────────────────
// Tier 1 + 2 offline entities (read-only cached master data)
// ─────────────────────────────────────────────────────────────

export interface LocalMedicine {
  id: string;           // = server id
  tenant_id: string;
  code: string | null;
  barcode: string | null;
  name: string;
  generic_name: string | null;
  manufacturer: string | null;
  category: string | null;
  unit: string | null;
  hsn_code: string | null;
  gst_rate: number;
  reorder_level: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocalLabTest {
  id: string;
  tenant_id: string;
  code: string | null;
  name: string;
  category: string | null;
  sample_type: string | null;
  unit: string | null;
  reference_min: number | null;
  reference_max: number | null;
  reference_text: string | null;
  price: number;
  turnaround_hrs: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocalOrganization {
  id: string;
  tenant_id: string;
  name: string;
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface LocalBranch {
  id: string;
  tenant_id: string;
  organization_id: string | null;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  phone: string | null;
  branch_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocalEncounterHeader {
  id: string;           // = server id
  tenant_id: string;
  branch_id: string | null;
  patient_id: string;
  doctor_id: string | null;
  appointment_id: string | null;
  encounter_type: string | null;
  encounter_date: string;
  status: 'DRAFT' | 'COMPLETED' | string;
  chief_complaint: string | null;
  history: string | null;
  examination: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}