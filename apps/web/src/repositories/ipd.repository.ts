import { api } from '@/lib/api';

export interface Location {
  id: string;
  tenant_id: string;
  branch_id: string;
  parent_id: string | null;
  type: 'FACILITY' | 'BUILDING' | 'FLOOR' | 'WARD' | 'ROOM' | 'BED';
  name: string;
  code: string | null;
  capacity: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BedWithStatus {
  bed_id: string;
  tenant_id: string;
  branch_id: string;
  bed_name: string;
  bed_code: string | null;
  is_active: boolean;
  room_id: string | null;
  room_name: string | null;
  ward_id: string | null;
  ward_name: string | null;
  bed_status: 'AVAILABLE' | 'OCCUPIED' | 'INACTIVE';
  current_admission_id: string | null;
  current_patient_id: string | null;
}

export interface Admission {
  id: string;
  tenant_id: string;
  branch_id: string;
  patient_id: string;
  bed_id: string;
  admitting_doctor: string;
  admitted_at: string;
  expected_discharge: string | null;
  discharged_at: string | null;
  status: 'ADMITTED' | 'TRANSFERRED' | 'DISCHARGED' | 'CANCELLED';
  reason: string | null;
  diagnosis: string | null;
  notes: string | null;
  discharge_summary: string | null;
  discharge_type: string | null;
  created_at: string;
  updated_at: string;
  patients?: { id: string; uhid: string; full_name: string; mobile: string | null; date_of_birth: string | null; gender: string | null };
  doctors?: { id: string; full_name: string };
  branches?: { id: string; name: string; branch_code: string };
}

export interface NursingNote {
  id: string;
  tenant_id: string;
  admission_id: string;
  note_type: string;
  note: string;
  recorded_by: string | null;
  recorded_at: string;
  by?: { full_name: string } | null;
}

export interface DoctorRound {
  id: string;
  tenant_id: string;
  admission_id: string;
  doctor_id: string;
  round_at: string;
  clinical_notes: string | null;
  assessment: string | null;
  plan: string | null;
  doctor?: { full_name: string } | null;
}

export interface MarRecord {
  id: string;
  tenant_id: string;
  admission_id: string;
  medication_name: string;
  dose: string | null;
  route: string | null;
  scheduled_at: string;
  administered_at: string | null;
  administered_by: string | null;
  status: 'SCHEDULED' | 'ADMINISTERED' | 'HELD' | 'REFUSED' | 'MISSED';
  notes: string | null;
  by?: { full_name: string } | null;
}

export interface BedTransfer {
  id: string;
  tenant_id: string;
  admission_id: string;
  from_bed_id: string | null;
  to_bed_id: string;
  reason: string;
  transferred_by: string | null;
  transferred_at: string;
  from_bed?: { name: string } | null;
  to_bed?: { name: string } | null;
  by?: { full_name: string } | null;
}

export interface AdmissionFull extends Admission {
  bed: Location;
  transfers: BedTransfer[];
  nursing_notes: NursingNote[];
  rounds: DoctorRound[];
  mar: MarRecord[];
}

export const ipdRepository = {
  listLocations: (params: { branchId?: string; parentId?: string; type?: string } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)); });
    return api.get<Location[]>(`/ipd/locations?${qs.toString()}`);
  },
  createLocation: (input: { branchId: string; parentId?: string | null; type: string; name: string; code?: string | null; capacity?: number | null }) =>
    api.post<Location>('/ipd/locations', input),
  updateLocation: (id: string, patch: { name?: string; code?: string | null; capacity?: number | null; isActive?: boolean }) =>
    api.patch<Location>(`/ipd/locations/${id}`, patch),
  deleteLocation: (id: string) => api.delete<{ success: boolean }>(`/ipd/locations/${id}`),

  listBeds: (branchId?: string) =>
    api.get<BedWithStatus[]>(`/ipd/beds${branchId ? `?branchId=${branchId}` : ''}`),

  listAdmissions: (params: { status?: string; patientId?: string; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    return api.get<{ rows: Admission[]; total: number; page: number; pageSize: number }>(`/ipd/admissions?${qs.toString()}`);
  },
  getAdmission: (id: string) => api.get<AdmissionFull>(`/ipd/admissions/${id}`),
  admit: (input: { patientId: string; bedId: string; admittingDoctor: string; branchId?: string; reason?: string | null; diagnosis?: string | null; expectedDischarge?: string | null }) =>
    api.post<{ admissionId: string }>('/ipd/admissions', input),
  transfer: (admissionId: string, input: { toBedId: string; reason: string }) =>
    api.post<{ success: boolean }>(`/ipd/admissions/${admissionId}/transfer`, input),
  discharge: (admissionId: string, input: { dischargeType: string; dischargeSummary?: string | null }) =>
    api.post<{ success: boolean }>(`/ipd/admissions/${admissionId}/discharge`, input),

  createNursingNote: (admissionId: string, input: { noteType: string; note: string }) =>
    api.post<NursingNote>(`/ipd/admissions/${admissionId}/nursing-notes`, input),
  createDoctorRound: (admissionId: string, input: { clinicalNotes?: string | null; assessment?: string | null; plan?: string | null }) =>
    api.post<DoctorRound>(`/ipd/admissions/${admissionId}/rounds`, input),
  createMar: (admissionId: string, input: { medicationName: string; dose?: string | null; route?: string | null; scheduledAt: string; notes?: string | null }) =>
    api.post<MarRecord>(`/ipd/admissions/${admissionId}/mar`, input),
  markMar: (marId: string, input: { status: string; notes?: string | null }) =>
    api.patch<MarRecord>(`/ipd/mar/${marId}`, input),
};
