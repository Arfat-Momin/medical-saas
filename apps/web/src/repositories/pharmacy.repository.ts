import { api } from '@/lib/api';

export interface Medicine {
  id: string; tenant_id: string;
  code: string | null; barcode: string | null; name: string; generic_name: string | null;
  manufacturer: string | null; category: string | null; unit: string | null;
  hsn_code: string | null; gst_rate: number; reorder_level: number;
  is_active: boolean; created_at: string; updated_at: string;
}

export interface Supplier {
  id: string; tenant_id: string;
  code: string | null; name: string;
  contact_person: string | null; phone: string | null; email: string | null;
  address: string | null; gstin: string | null;
  is_active: boolean; created_at: string; updated_at: string;
}

export interface Batch {
  id: string; tenant_id: string; medicine_id: string;
  batch_no: string; expiry_date: string;
  mrp: number | null; purchase_price: number | null; selling_price: number | null;
  current_qty: number; is_active: boolean;
  medicines?: { id: string; name: string; unit: string | null };
}

export interface Purchase {
  id: string; tenant_id: string; supplier_id: string;
  invoice_no: string | null; purchase_date: string;
  total_amount: number; status: 'DRAFT' | 'RECEIVED' | 'CANCELLED';
  notes: string | null; created_at: string;
  suppliers?: { id: string; name: string };
}

export interface Dispense {
  id: string; tenant_id: string; patient_id: string;
  total_amount: number; created_at: string;
  patients?: { id: string; uhid: string; full_name: string };
}

export interface LowStockRow {
  tenant_id: string; medicine_id: string; name: string;
  reorder_level: number; total_qty: number;
}

export interface ExpiringRow {
  tenant_id: string; batch_id: string; batch_no: string;
  expiry_date: string; current_qty: number;
  medicine_id: string; medicine_name: string;
}

export const pharmacyRepository = {
  getMedicineByBarcode: (barcode: string) => 
    api.get<Medicine & { batches: any[] }>(`/pharmacy/medicines/barcode/${barcode}`),

  listMedicines: (params: { search?: string; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    return api.get<{ rows: Medicine[]; total: number; page: number; pageSize: number }>(`/pharmacy/medicines?${qs.toString()}`);
  },
  createMedicine: (input: Partial<Medicine> & { name: string }) =>
    api.post<Medicine>('/pharmacy/medicines', input),
  updateMedicine: (id: string, patch: Partial<Medicine>) =>
    api.patch<Medicine>(`/pharmacy/medicines/${id}`, patch),

  listSuppliers: () => api.get<Supplier[]>('/pharmacy/suppliers'),
  createSupplier: (input: Partial<Supplier> & { name: string }) =>
    api.post<Supplier>('/pharmacy/suppliers', input),
  updateSupplier: (id: string, patch: Partial<Supplier>) =>
    api.patch<Supplier>(`/pharmacy/suppliers/${id}`, patch),

  listBatches: (params: { medicineId?: string; onlyInStock?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.medicineId) qs.set('medicineId', params.medicineId);
    if (params.onlyInStock) qs.set('onlyInStock', 'true');
    return api.get<Batch[]>(`/pharmacy/batches?${qs.toString()}`);
  },

  listPurchases: (page = 1, pageSize = 20) =>
    api.get<{ rows: Purchase[]; total: number }>(`/pharmacy/purchases?page=${page}&pageSize=${pageSize}`),
  receivePurchase: (input: {
    supplierId: string; invoiceNo?: string | null; purchaseDate?: string;
    notes?: string | null;
    items: { medicineId: string; batchNo: string; expiryDate: string; qty: number;
             purchasePrice: number; mrp?: number | null; sellingPrice?: number | null }[];
  }) => api.post<{ purchaseId: string; totalAmount: number }>('/pharmacy/purchases', input),

  dispense: (input: {
    patientId: string; encounterId?: string | null; branchId?: string;
    notes?: string | null;
    items: { medicineId: string; qty: number }[];
  }) => api.post<{ dispenseId: string; totalAmount: number }>('/pharmacy/dispense', input),

  listDispenses: (page = 1, pageSize = 20) =>
    api.get<{ rows: Dispense[]; total: number }>(`/pharmacy/dispenses?page=${page}&pageSize=${pageSize}`),

  lowStock: () => api.get<LowStockRow[]>('/pharmacy/alerts/low-stock'),
  expiring: () => api.get<ExpiringRow[]>('/pharmacy/alerts/expiring'),

  adjustStock: (input: { batchId: string; qtyDelta: number; reason: string }) =>
    api.post<{ transactionId: string }>('/pharmacy/adjust', input),
};