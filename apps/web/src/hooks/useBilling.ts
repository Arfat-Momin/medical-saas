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
  return useQuery({ queryKey: [...INVOICES, id], queryFn: () => repo.getInvoice(id!), enabled: Boolean(id) });
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
    },
  });
}
