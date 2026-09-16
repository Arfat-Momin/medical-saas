import { api } from '@/lib/api';

export interface PharmacyQueueItem {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  encounter_id: string;
  patient_id: string;
  doctor_id: string | null;
  items: Array<{
    medicineName: string;
    dosage?: string | null;
    frequency?: string | null;
    duration?: string | null;
    route?: string | null;
    instructions?: string | null;
    quantity?: string | null;
  }>;
  status: 'PENDING' | 'DISPENSED' | 'CANCELLED';
  dispense_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  patients?: { id: string; uhid: string; full_name: string; mobile: string | null };
  doctors?: { id: string; full_name: string };
  encounters?: { id: string; encounter_date: string; chief_complaint: string | null };
  pharmacy_invoice?: { id: string; invoice_no: string; total_amount: number; status: string } | null;
}

export const pharmacyQueueRepository = {
  list: (params: { status?: string; page?: number; pageSize?: number } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    });
    return api.get<{ rows: PharmacyQueueItem[]; total: number; page: number; pageSize: number }>(
      `/pharmacy-queue?${qs.toString()}`,
    );
  },

  getById: (id: string) => api.get<PharmacyQueueItem>(`/pharmacy-queue/${id}`),

  markDispensed: (id: string, dispenseId: string) =>
    api.post<PharmacyQueueItem>(`/pharmacy-queue/${id}/dispensed`, { dispenseId }),

  cancel: (id: string) => api.post<PharmacyQueueItem>(`/pharmacy-queue/${id}/cancel`, {}),
};
