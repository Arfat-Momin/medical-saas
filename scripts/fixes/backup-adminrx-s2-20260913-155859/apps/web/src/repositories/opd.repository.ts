import { api } from '@/lib/api';

export interface Vitals {
  temperature_c: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  pulse: number | null;
  resp_rate: number | null;
  spo2: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  bmi: number | null;
}

export interface Diagnosis {
  id: string;
  diagnosis_text: string;
  icd_code: string | null;
  notes: string | null;
  is_primary: boolean;
}

export interface PrescriptionItem {
  id: string;
  medicine_name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  route: string | null;
  instructions: string | null;
  quantity: number | null;
}

export interface Prescription {
  id: string;
  notes: string | null;
  items: PrescriptionItem[];
}

export interface Encounter {
  id: string;
  tenant_id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id: string | null;
  encounter_type: 'OPD' | 'IPD' | 'EMERGENCY';
  encounter_date: string;
  status: 'DRAFT' | 'COMPLETED' | 'AMENDED';
  chief_complaint: string | null;
  history: string | null;
  examination: string | null;
  notes: string | null;
  patients: any;
  doctors: any;
  branches: any;
  appointments: any;
  vitals: Vitals | null;
  diagnoses: Diagnosis[];
  prescription: Prescription | null;
}

export interface SaveEncounterInput {
  chiefComplaint?: string | null;
  history?: string | null;
  examination?: string | null;
  notes?: string | null;
  vitals?: Partial<{
    temperatureC: number | string | null;
    bpSystolic: number | string | null;
    bpDiastolic: number | string | null;
    pulse: number | string | null;
    respRate: number | string | null;
    spo2: number | string | null;
    weightKg: number | string | null;
    heightCm: number | string | null;
    bmi: number | string | null;
  }>;
  diagnoses?: { diagnosisText: string; icdCode?: string | null; notes?: string | null; isPrimary?: boolean }[];
  prescription?: {
    notes?: string | null;
    items: { medicineName: string; dosage?: string | null; frequency?: string | null; duration?: string | null; route?: string | null; instructions?: string | null; quantity?: number | string | null }[];
  };
  complete?: boolean;
}

export interface AdminEditPrescriptionInput {
  prescription: {
    notes?: string | null;
    items: {
      medicineName: string;
      dosage?: string | null;
      frequency?: string | null;
      duration?: string | null;
      route?: string | null;
      instructions?: string | null;
      quantity?: number | string | null;
    }[];
  } | null;
}

export const opdRepository = {
  getEncounter: (id: string) => api.get<Encounter>(`/opd/encounters/${id}`),

  adminEditPrescription: (serverId: string, input: AdminEditPrescriptionInput) =>
    api.put<Encounter>(`/opd/encounters/${serverId}/prescription`, input),
  saveEncounter: (id: string, input: SaveEncounterInput) =>
    api.patch<Encounter>(`/opd/encounters/${id}`, input),
  createWalkIn: (input: { patientId: string; doctorId: string; branchId?: string; chiefComplaint?: string | null }) =>
    api.post<Encounter>('/opd/encounters', input),
  list: (params: { patientId?: string; doctorId?: string; date?: string }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)); });
    return api.get<{ rows: Encounter[]; total: number }>(`/opd/encounters?${qs.toString()}`);
  },
};