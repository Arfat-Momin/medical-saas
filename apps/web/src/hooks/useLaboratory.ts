import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { laboratoryRepository as repo } from '@/repositories/laboratory.repository';
import { labTestsLocalRepository } from '@/repositories/offline.repositories';
import { db } from '@/db';
import { syncEngine } from '@/sync/engine';
import { useAuthStore } from '@/stores/auth.store';

const TESTS  = ['lab', 'tests'];
const ORDERS = ['lab', 'orders'];

/**
 * Tenant-scoped lab-test catalog.
 *
 * Same refresh policy as useMedicines: await the pull only when the
 * local cache is empty, otherwise background-refresh.
 */
export function useLabTests(params: {
  search?: string;
  page?: number;
  pageSize?: number;
  activeOnly?: boolean;
}) {
  const tenantId = useAuthStore((s) => s.tenantId);

  return useQuery({
    queryKey: [...TESTS, tenantId, params],
    enabled: !!tenantId,
    queryFn: async () => {
      if (!tenantId) {
        return {
          rows: [] as any[],
          total: 0,
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 20,
        };
      }

      const online = typeof navigator !== 'undefined' && navigator.onLine !== false;
      if (online) {
        const localCount = await db.labTests
          .where('tenant_id').equals(tenantId).count();
        if (localCount === 0) {
          try { await syncEngine.pullEntity('lab_tests'); } catch { /* best effort */ }
        } else {
          void syncEngine.pullEntity('lab_tests').catch(() => {});
        }
      }

      return labTestsLocalRepository.list(params);
    },
    staleTime: 10_000,
  });
}

export function useCreateLabTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: repo.createTest,
    onSuccess: async () => {
      try { await syncEngine.pullEntity('lab_tests'); } catch { /* best effort */ }
      qc.invalidateQueries({ queryKey: TESTS });
    },
  });
}

export function useUpdateLabTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) => repo.updateTest(id, patch),
    onSuccess: async () => {
      try { await syncEngine.pullEntity('lab_tests'); } catch { /* best effort */ }
      qc.invalidateQueries({ queryKey: TESTS });
    },
  });
}

export function useLabOrders(params: {
  status?: string;
  patientId?: string;
  date?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery({ queryKey: [...ORDERS, params], queryFn: () => repo.listOrders(params) });
}
export function useLabOrder(id: string | undefined) {
  return useQuery({ queryKey: [...ORDERS, id], queryFn: () => repo.getOrder(id!), enabled: Boolean(id) });
}
export function useCreateLabOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: repo.createOrder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ORDERS });
      qc.invalidateQueries({ queryKey: ['billing', 'invoices'] });
    },
  });
}
export function useCollectSample(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { sampleType: string; barcode?: string | null; notes?: string | null }) =>
      repo.collect(orderId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ORDERS });
      qc.invalidateQueries({ queryKey: [...ORDERS, orderId] });
    },
  });
}
export function useEnterResults(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: any[]) => repo.enterResults(orderId, items),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ORDERS });
      qc.invalidateQueries({ queryKey: [...ORDERS, orderId] });
    },
  });
}
export function useVerifyResults(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => repo.verify(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ORDERS });
      qc.invalidateQueries({ queryKey: [...ORDERS, orderId] });
    },
  });
}