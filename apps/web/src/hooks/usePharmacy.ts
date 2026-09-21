import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pharmacyRepository as repo } from '@/repositories/pharmacy.repository';
import { medicinesLocalRepository } from '@/repositories/offline.repositories';
import { db } from '@/db';
import { syncEngine } from '@/sync/engine';
import { useAuthStore } from '@/stores/auth.store';

const MED  = ['pharmacy', 'medicines'];
const SUP  = ['pharmacy', 'suppliers'];
const BAT  = ['pharmacy', 'batches'];
const PUR  = ['pharmacy', 'purchases'];
const DISP = ['pharmacy', 'dispenses'];
const LOW  = ['pharmacy', 'low-stock'];
const EXP  = ['pharmacy', 'expiring'];

/**
 * Tenant-scoped medicines list.
 *
 * Reads from Dexie. Refresh behaviour:
 *   - local empty  -> await a fresh pull so the first render has data
 *   - local present -> fire-and-forget refresh (React Query re-renders
 *     when the cache updates)
 *
 * The previous version only pulled when localCount === 0, which meant
 * newly-created medicines on the server never appeared in the list.
 */
export function useMedicines(params: {
  search?: string;
  page?: number;
  pageSize?: number;
  activeOnly?: boolean;
}) {
  const tenantId = useAuthStore((s) => s.tenantId);

  return useQuery({
    queryKey: [...MED, tenantId, params],
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
        const localCount = await db.medicines
          .where('tenant_id').equals(tenantId).count();
        if (localCount === 0) {
          try { await syncEngine.pullEntity('medicines'); } catch { /* best effort */ }
        } else {
          void syncEngine.pullEntity('medicines').catch(() => {});
        }
      }

      return medicinesLocalRepository.list(params);
    },
    staleTime: 10_000,
  });
}

export function useCreateMedicine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: repo.createMedicine,
    onSuccess: async () => {
      // Pull the newly-created row into Dexie before re-reading.
      try { await syncEngine.pullEntity('medicines'); } catch { /* best effort */ }
      qc.invalidateQueries({ queryKey: MED });
    },
  });
}

export function useUpdateMedicine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) => repo.updateMedicine(id, patch),
    onSuccess: async () => {
      try { await syncEngine.pullEntity('medicines'); } catch { /* best effort */ }
      qc.invalidateQueries({ queryKey: MED });
    },
  });
}

export function useSuppliers() {
  return useQuery({ queryKey: SUP, queryFn: repo.listSuppliers });
}
export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: repo.createSupplier,
    onSuccess: () => qc.invalidateQueries({ queryKey: SUP }),
  });
}

export function useBatches(params: { medicineId?: string; onlyInStock?: boolean } = {}) {
  return useQuery({ queryKey: [...BAT, params], queryFn: () => repo.listBatches(params) });
}

export function usePurchases(page = 1, pageSize = 20) {
  return useQuery({ queryKey: [...PUR, page, pageSize], queryFn: () => repo.listPurchases(page, pageSize) });
}
export function useReceivePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: repo.receivePurchase,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PUR });
      qc.invalidateQueries({ queryKey: BAT });
      qc.invalidateQueries({ queryKey: MED });
      qc.invalidateQueries({ queryKey: LOW });
    },
  });
}

export function useDispenses(page = 1, pageSize = 20) {
  return useQuery({ queryKey: [...DISP, page, pageSize], queryFn: () => repo.listDispenses(page, pageSize) });
}
export function useDispense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: repo.dispense,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DISP });
      qc.invalidateQueries({ queryKey: BAT });
      qc.invalidateQueries({ queryKey: LOW });
      qc.invalidateQueries({ queryKey: ['billing', 'invoices'] });
    },
  });
}

export function useLowStock() { return useQuery({ queryKey: LOW, queryFn: repo.lowStock }); }
export function useExpiring() { return useQuery({ queryKey: EXP, queryFn: repo.expiring }); }

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: repo.adjustStock,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BAT });
      qc.invalidateQueries({ queryKey: LOW });
    },
  });
}