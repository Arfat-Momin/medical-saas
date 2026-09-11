import { api } from '@/lib/api';

export interface LabTest {
  id: string; tenant_id: string;
  code: string | null; name: string;
  category: string | null; sample_type: string | null; unit: string | null;
  reference_min: number | null; reference_max: number | null; reference_text: string | null;
  price: number; turnaround_hrs: number; is_active: boolean;
  created_at: string; updated_at: string;
}

export interface LabOrderItem {
  id: string; tenant_id: string; order_id: string; test_id: string;
  test_code: string | null; test_name: string; sample_type: string | null;
  price: number;
  result_value: string | null; result_unit: string | null; reference_text: string | null;
  flag: 'NORMAL'|'HIGH'|'LOW'|'ABNORMAL'|'CRITICAL'|null;
  resulted_by: string | null; resulted_at: string | null;
  verified_by: string | null; verified_at: string | null;
  remarks: string | null;
}

export interface LabSample {
  id: string; tenant_id: string; order_id: string;
  sample_type: string; barcode: string | null;
  collected_by: string | null; collected_at: string;
  notes: string | null;
}

export interface LabOrder {
  id: string; tenant_id: string; branch_id: string;
  patient_id: string; doctor_id: string;
  encounter_id: string | null;
  order_date: string;
  status: 'ORDERED'|'COLLECTED'|'RESULTED'|'VERIFIED'|'CANCELLED';
  priority: 'ROUTINE'|'URGENT'|'STAT';
  notes: string | null;
  total_amount: number;
  created_at: string; updated_at: string;
  patients?: { id: string; uhid: string; full_name: string; mobile: string | null; date_of_birth: string | null; gender: string | null };
  doctors?: { id: string; full_name: string };
  branches?: { id: string; name: string; branch_code: string };
  items?: LabOrderItem[];
  samples?: LabSample[];
}

export const laboratoryRepository = {
  listTests: (params: { search?: string; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    return api.get<{ rows: LabTest[]; total: number; page: number; pageSize: number }>(`/laboratory/tests?${qs.toString()}`);
  },
  createTest: (input: Partial<LabTest> & { name: string }) => api.post<LabTest>('/laboratory/tests', input),
  updateTest: (id: string, patch: Partial<LabTest>) => api.patch<LabTest>(`/laboratory/tests/${id}`, patch),

  listOrders: (params: { status?: string; patientId?: string; date?: string; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    return api.get<{ rows: LabOrder[]; total: number; page: number; pageSize: number }>(`/laboratory/orders?${qs.toString()}`);
  },
  getOrder: (id: string) => api.get<LabOrder>(`/laboratory/orders/${id}`),
  createOrder: (input: { patientId: string; doctorId: string; branchId?: string; encounterId?: string | null; priority?: string; notes?: string | null; testIds: string[]; }) =>
    api.post<{ orderId: string; totalAmount: number }>('/laboratory/orders', input),
  collect: (id: string, input: { sampleType: string; barcode?: string | null; notes?: string | null }) =>
    api.post<LabSample>(`/laboratory/orders/${id}/collect`, input),
  enterResults: (id: string, items: { itemId: string; resultValue?: string | null; resultUnit?: string | null; flag?: string | null; remarks?: string | null }[]) =>
    api.post<LabOrder>(`/laboratory/orders/${id}/results`, { items }),
  verify: (id: string) => api.post<LabOrder>(`/laboratory/orders/${id}/verify`, {}),
};