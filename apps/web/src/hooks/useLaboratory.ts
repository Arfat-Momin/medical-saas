import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { laboratoryRepository as repo } from '@/repositories/laboratory.repository';
import { labTestsLocalRepository } from '@/repositories/offline.repositories';
import { db, meta } from '@/db';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

const TESTS  = ['lab', 'tests'];
const ORDERS = ['lab', 'orders'];

/**
 * Tenant-scoped lab-test catalog.
 *
 * - Gated on tenantId; queryKey includes tenantId.
 * - Pulls /sync/pull?entity=lab_tests directly (backend entity name).
 * - Counts rows for the current tenant only (was counting every tenant).
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
      const localCount = await db.labTests
        .where('tenant_id')
        .equals(tenantId)
        .count();

      if (online && localCount === 0) {
        try {
          const cursorKey = `last_pull_at:${tenantId}:lab_tests`;
          const since = await meta.get(cursorKey);
          const url = `/sync/pull?entity=lab_tests${
            since ? `&since=${encodeURIComponent(since)}` : ''
          }`;
          const res = await api.get<{ rows: any[]; serverTime: string }>(url);
          for (const row of res.rows) {
            await labTestsLocalRepository.upsertFromServer(row);
          }
          await meta.set(cursorKey, res.serverTime);
        } catch (err) {
          console.warn('[useLabTests] pull failed', err);
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
    onSuccess: () => qc.invalidateQueries({ queryKey: TESTS }),
  });
}

export function useUpdateLabTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) => repo.updateTest(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: TESTS }),
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