import { api } from '@/lib/api';

export interface Patient {
  id: string;
  tenant_id: string;
  branch_id: string;
  uhid: string;
  full_name: string;
  date_of_birth: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  mobile: string | null;
  address: string | null;
  blood_group: string | null;
  allergies: string | null;
  medical_history: string | null;
  emergency_contact: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListPatientsResponse {
  rows: Patient[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreatePatientInput {
  fullName: string;
  dateOfBirth?: string | null;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | null;
  mobile?: string | null;
  address?: string | null;
  bloodGroup?: string | null;
  allergies?: string | null;
  medicalHistory?: string | null;
  emergencyContact?: string | null;
  branchId?: string;
  skipDuplicateCheck?: boolean;
}

export interface DuplicateMatch {
  id: string;
  uhid: string;
  full_name: string;
  mobile: string | null;
  date_of_birth: string | null;
  reason: 'same_mobile' | 'same_name_dob';
}

export const patientsRepository = {
  list: (params: { page?: number; pageSize?: number; search?: string; branchId?: string }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    });
    return api.get<ListPatientsResponse>(`/patients?${qs.toString()}`);
  },
  getById: (id: string) => api.get<Patient>(`/patients/${id}`),
  checkDuplicate: (input: { mobile?: string; fullName?: string; dateOfBirth?: string }) =>
    api.post<{ hasDuplicates: boolean; matches: DuplicateMatch[] }>('/patients/check-duplicate', input),
  create: (input: CreatePatientInput) => api.post<Patient>('/patients', input),
  update: (id: string, patch: Partial<CreatePatientInput>) =>
    api.patch<Patient>(`/patients/${id}`, patch),
};