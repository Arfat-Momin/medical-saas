import { api } from '@/lib/api';

// ---------- Billable items ----------
export interface BillableItem {
    id: string;
    tenant_id: string;
    code: string | null;
    name: string;
    category: 'CONSULTATION' | 'PROCEDURE' | 'ROOM' | 'SERVICE' | 'OTHER';
    price: number;
    tax_rate: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

// ---------- Invoice ----------
export interface InvoiceItem {
    id: string;
    tenant_id: string;
    invoice_id: string;
    item_type: 'MANUAL' | 'CONSULTATION' | 'LAB' | 'PHARMACY' | 'PROCEDURE' | 'IPD';
    source_id: string | null;
    description: string;
    qty: number;
    unit_price: number;
    discount: number;
    tax_rate: number;
    amount: number;
    created_at: string;
}

export interface Payment {
    id: string;
    tenant_id: string;
    invoice_id: string;
    amount: number;
    method: 'CASH' | 'CARD' | 'UPI' | 'NETBANKING' | 'INSURANCE' | 'CREDIT' | 'OTHER';
    reference: string | null;
    notes: string | null;
    received_by: string | null;
    received_at: string;
    received?: { full_name: string } | null;
}

export interface Refund {
    id: string;
    tenant_id: string;
    invoice_id: string;
    payment_id: string | null;
    amount: number;
    reason: string;
    refunded_by: string | null;
    refunded_at: string;
    refunded?: { full_name: string } | null;
}

export interface Invoice {
    id: string;
    tenant_id: string;
    branch_id: string;
    invoice_no: string;
    patient_id: string;
    encounter_id: string | null;
    status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'REFUNDED' | 'CANCELLED';
    subtotal: number;
    discount_amount: number;
    tax_amount: number;
    total_amount: number;
    paid_amount: number;
    balance_amount: number;
    notes: string | null;
    created_at: string;
    updated_at: string;
    finalized_at: string | null;
    invoice_type?: 'COMBINED' | 'DOCTOR' | 'PHARMACY' | 'LAB' | 'IPD';
    ipd_admission_id?: string | null;
    patients?: { id: string; uhid: string; full_name: string; mobile: string | null };
    branches?: { id: string; name: string; branch_code: string };
}

export interface InvoiceFull extends Invoice {
    items: InvoiceItem[];
    payments: Payment[];
    refunds: Refund[];
}

export interface CreateInvoiceInput {
    patientId: string;
    encounterId?: string | null;
    branchId?: string;
    invoiceType?: 'COMBINED' | 'DOCTOR' | 'PHARMACY' | 'LAB' | 'IPD';
    ipdAdmissionId?: string | null;
    notes?: string | null;
    discount: number;
    items: {
        itemType?: 'MANUAL' | 'CONSULTATION' | 'LAB' | 'PHARMACY' | 'PROCEDURE' | 'IPD';
        sourceId?: string | null;
        description: string;
        qty: number;
        unitPrice: number;
        discount: number;
        taxRate: number;
    }[];
}

export const billingRepository = {
    // ---- Billable items ----
    listItems: (params: { search?: string; category?: string; page?: number; pageSize?: number }) => {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
        return api.get<{ rows: BillableItem[]; total: number; page: number; pageSize: number }>(`/billing/items?${qs.toString()}`);
    },
    createItem: (input: Partial<BillableItem> & { name: string; category: string; price: number; taxRate: number }) =>
        api.post<BillableItem>('/billing/items', input),
    updateItem: (id: string, patch: Partial<BillableItem> & { taxRate?: number; isActive?: boolean }) =>
        api.patch<BillableItem>(`/billing/items/${id}`, patch),

    // ---- Invoices ----
    listInvoices: (params: { patientId?: string; invoiceType?: string; status?: string; from?: string; to?: string; page?: number; pageSize?: number }) => {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
        return api.get<{ rows: Invoice[]; total: number; page: number; pageSize: number }>(`/billing/invoices?${qs.toString()}`);
    },
    getInvoiceTotals: (params: { patientId?: string; invoiceType?: string; status?: string; from?: string; to?: string }) => {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
        return api.get<{ collected_amount: number; pending_amount: number }>(`/billing/invoices/totals?${qs.toString()}`);
    },
    getInvoice: (id: string) => api.get<InvoiceFull>(`/billing/invoices/${id}`),
    createInvoice: (input: CreateInvoiceInput) =>
        api.post<{ invoiceId: string; invoiceNo: string; totalAmount: number }>('/billing/invoices', input),
    invoiceFromEncounter: (input: { encounterId: string; includeConsult?: boolean; includeLab?: boolean; includePharmacy?: boolean; consultationFee?: number }) =>
        api.post<{ invoiceId: string; invoiceNo: string; totalAmount: number }>('/billing/invoices/from-encounter', input),

    // ---- IPD custom bill ----
    createIpdDraft: (input: { admissionId: string }) =>
        api.post<{ invoiceId: string; invoiceNo: string; created: boolean }>('/billing/invoices/ipd-draft', input),
    replaceIpdItems: (invoiceId: string, input: { discount: number; items: any[] }) =>
        api.put<{ invoiceId: string; totalAmount: number }>(`/billing/invoices/${invoiceId}/items`, input),
    getIpdBillByAdmission: (admissionId: string) =>
        api.get<Invoice | null>(`/billing/admissions/${admissionId}/ipd-bill`),

    // ---- Payments / Refunds ----
    recordPayment: (invoiceId: string, input: { amount: number; method: string; reference?: string | null; notes?: string | null }) =>
        api.post<{ paymentId: string; paidAmount: number; balanceAmount: number; status: string }>(
            `/billing/invoices/${invoiceId}/payments`, input),
    refundPayment: (invoiceId: string, input: { paymentId: string; amount: number; reason: string }) =>
        api.post<{ refundId: string; status: string; balanceAmount: number }>(
            `/billing/invoices/${invoiceId}/refunds`, input),
};

// ---- Per-department invoice list methods ----
export const listDoctorInvoices = (params: { page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, String(v)); });
    return api.get<{ rows: Invoice[]; total: number; page: number; pageSize: number }>(
        `/billing/doctor-invoices?${qs.toString()}`);
};

export const listPharmacyInvoices = (params: { page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, String(v)); });
    return api.get<{ rows: Invoice[]; total: number; page: number; pageSize: number }>(
        `/billing/pharmacy-invoices?${qs.toString()}`);
};

export const listLabInvoices = (params: { page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, String(v)); });
    return api.get<{ rows: Invoice[]; total: number; page: number; pageSize: number }>(
        `/billing/lab-invoices?${qs.toString()}`);
};

// ---- Extra methods used by useBilling (sub-invoices + discount) ----
export const billingRepositoryExtra = {
    listSubInvoices: (parentInvoiceId: string) =>
        api.get<{ rows: Invoice[] }>(`/billing/invoices/${parentInvoiceId}/sub-invoices`),
    updateDiscount: (invoiceId: string, discount: number) =>
        api.patch<Invoice>(`/billing/invoices/${invoiceId}/discount`, { discount }),
};