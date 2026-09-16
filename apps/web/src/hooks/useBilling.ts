import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { billingRepository as repo, type CreateInvoiceInput } from '@/repositories/billing.repository';

const ITEMS = ['billing', 'items'];
const INVOICES = ['billing', 'invoices'];

// ---- Billable items ----
export function useBillableItems(params: { search?: string; category?: string; page?: number; pageSize?: number }) {
  return useQuery({ queryKey: [...ITEMS, params], queryFn: () => repo.listItems(params) });
}
export function useCreateBillableItem() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: repo.createItem, onSuccess: () => qc.invalidateQueries({ queryKey: ITEMS }) });
}
export function useUpdateBillableItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) => repo.updateItem(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ITEMS }),
  });
}

// ---- Invoices ----
export function useInvoices(params: { patientId?: string; status?: string; from?: string; to?: string; page?: number; pageSize?: number }) {
  return useQuery({ queryKey: [...INVOICES, params], queryFn: () => repo.listInvoices(params) });
}
export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: [...INVOICES, id],
    queryFn: () => repo.getInvoice(id!),
    enabled: Boolean(id),
    // Invoices can be mutated server-side (auto-invoice on consultation,
    // pharmacy dispense, lab order). Always re-fetch when the page mounts
    // or the user returns to the tab so the UI never shows stale items.
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}
export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInvoiceInput) => repo.createInvoice(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: INVOICES }),
  });
}
export function useInvoiceFromEncounter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: repo.invoiceFromEncounter,
    onSuccess: () => qc.invalidateQueries({ queryKey: INVOICES }),
  });
}

// ---- Payments / Refunds ----
export function useRecordPayment(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { amount: number; method: string; reference?: string | null; notes?: string | null }) =>
      repo.recordPayment(invoiceId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INVOICES });
      qc.invalidateQueries({ queryKey: [...INVOICES, invoiceId] });
      qc.invalidateQueries({ queryKey: ['billing', 'sub-invoices', invoiceId] });
    },
  });
}
export function useRefundPayment(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { paymentId: string; amount: number; reason: string }) =>
      repo.refundPayment(invoiceId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INVOICES });
      qc.invalidateQueries({ queryKey: [...INVOICES, invoiceId] });
      qc.invalidateQueries({ queryKey: ['billing', 'sub-invoices', invoiceId] });
    },
  });
}

// ---- Per-department invoice hooks ----
export function useDoctorInvoices(params: { page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: ['billing', 'doctor-invoices', params],
    queryFn: () => import('@/repositories/billing.repository').then(m => m.listDoctorInvoices(params)),
  });
}
export function usePharmacyInvoices(params: { page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: ['billing', 'pharmacy-invoices', params],
    queryFn: () => import('@/repositories/billing.repository').then(m => m.listPharmacyInvoices(params)),
  });
}
export function useLabInvoices(params: { page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: ['billing', 'lab-invoices', params],
    queryFn: () => import('@/repositories/billing.repository').then(m => m.listLabInvoices(params)),
  });
}
// ---- Sub-invoices list (Source Invoices panel) ----
export function useSubInvoices(parentInvoiceId: string | undefined) {
  return useQuery({
    queryKey: ['billing', 'sub-invoices', parentInvoiceId],
    queryFn: async () => {
      const mod = await import('@/repositories/billing.repository');
      return mod.billingRepositoryExtra.listSubInvoices(parentInvoiceId!);
    },
    enabled: Boolean(parentInvoiceId),
    staleTime: 5_000,
  });
}

// ---- Update discount on the combined invoice ----
export function useUpdateDiscount(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (discount: number) => {
      const mod = await import('@/repositories/billing.repository');
      return mod.billingRepositoryExtra.updateDiscount(invoiceId, discount);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INVOICES });
      qc.invalidateQueries({ queryKey: [...INVOICES, invoiceId] });
      qc.invalidateQueries({ queryKey: ['billing', 'sub-invoices', invoiceId] });
    },
  });
}