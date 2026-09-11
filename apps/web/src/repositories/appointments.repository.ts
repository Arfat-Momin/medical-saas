import { api } from '@/lib/api';

export interface AppointmentPatient { id: string; uhid: string; full_name: string; mobile: string | null; date_of_birth: string | null; gender: string | null }
export interface AppointmentDoctor  { id: string; full_name: string; email: string }

export interface Appointment {
  id: string;
  tenant_id: string;
  branch_id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  slot_time: string | null;
  queue_token: number | null;
  status: 'SCHEDULED' | 'CHECKED_IN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  chief_complaint: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  patients?: AppointmentPatient;
  doctors?: AppointmentDoctor;
  branches?: { id: string; name: string; branch_code: string };
}

export interface ListAppointmentsResponse {
  rows: Appointment[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateAppointmentInput {
  patientId: string;
  doctorId: string;
  branchId?: string;
  appointmentDate: string;
  slotTime?: string;
  chiefComplaint?: string | null;
  notes?: string | null;
}

export const appointmentsRepository = {
  list: (params: { date?: string; doctorId?: string; patientId?: string; status?: string; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    return api.get<ListAppointmentsResponse>(`/appointments?${qs.toString()}`);
  },
  today: (date?: string) =>
    api.get<ListAppointmentsResponse>(`/appointments/today${date ? `?date=${date}` : ''}`),
  getById: (id: string) => api.get<Appointment>(`/appointments/${id}`),
  create: (input: CreateAppointmentInput) => api.post<Appointment>('/appointments', input),
  checkIn: (id: string) => api.post<Appointment>(`/appointments/${id}/check-in`),
  start: (id: string) => api.post<{ id: string }>(`/appointments/${id}/start`),
  updateStatus: (id: string, status: string) =>
    api.patch<Appointment>(`/appointments/${id}/status`, { status }),
};