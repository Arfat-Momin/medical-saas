import { api } from '@/lib/api';

export interface ServerEncounter {
  id: string;
  patient_id: string;
  doctor_id: string;
  encounter_date: string;
  status: 'DRAFT' | 'COMPLETED';
  chief_complaint: string | null;
  history: string | null;
  examination: string | null;
  notes: string | null;
  vitals?: {
    temperature_c: number | null;
    bp_systolic: number | null;
    bp_diastolic: number | null;
    pulse: number | null;
    resp_rate: number | null;
    spo2: number | null;
    weight_kg: number | null;
    height_cm: number | null;
    bmi: number | null;
  } | null;
  diagnoses: Array<{
    id: string;
    diagnosis_text: string;
    icd_code: string | null;
    notes: string | null;
    is_primary: boolean;
  }>;
  prescription: {
    id: string;
    notes: string | null;
    items: Array<{
      id: string;
      medicine_name: string;
      dosage: string | null;
      frequency: string | null;
      duration: string | null;
      route: string | null;
      instructions: string | null;
      quantity: number | null;
    }>;
  } | null;
  lab_tests?: Array<{
    testId: string;
    testName: string;
    sampleType: string | null;
    referenceText: string | null;
  }>;
  patients?: { id: string; uhid: string; full_name: string };
  doctors?: { id: string; full_name: string };
}

export interface ListEncountersResponse {
  rows: ServerEncounter[];
  total: number;
  page: number;
  pageSize: number;
}

export const patientEncountersRepository = {
  listForPatient: (patientId: string, params: { page?: number; pageSize?: number } = {}) => {
    const qs = new URLSearchParams();
    qs.set('patientId', patientId);
    qs.set('page', String(params.page ?? 1));
    qs.set('pageSize', String(params.pageSize ?? 50));
    return api.get<ListEncountersResponse>(`/opd/encounters?${qs.toString()}`);
  },

  getById: (id: string) => api.get<ServerEncounter>(`/opd/encounters/${id}`),
};
