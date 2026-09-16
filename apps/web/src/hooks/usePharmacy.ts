import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pharmacyRepository as repo } from '@/repositories/pharmacy.repository';
import { medicinesLocalRepository } from '@/repositories/offline.repositories';
import { db, meta } from '@/db';
import { api } from '@/lib/api';
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
 * - Gated on tenantId; the queryKey includes tenantId so switching
 *   tenants refetches automatically.
 * - The pull is scoped to the current tenant (previously `db.medicines.count()`
 *   counted every tenant and skipped the pull when the wrong tenant's rows
 *   were present).
 * - Pulls /sync/pull?entity=medicines directly rather than relying on
 *   syncEngine.pull(), which does not cover this entity.
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
      const localCount = await db.medicines
        .where('tenant_id')
        .equals(tenantId)
        .count();

      if (online && localCount === 0) {
        try {
          const cursorKey = `last_pull_at:${tenantId}:medicines`;
          const since = await meta.get(cursorKey);
          const url = `/sync/pull?entity=medicines${
            since ? `&since=${encodeURIComponent(since)}` : ''
          }`;
          const res = await api.get<{ rows: any[]; serverTime: string }>(url);
          for (const row of res.rows) {
            await medicinesLocalRepository.upsertFromServer(row);
          }
          await meta.set(cursorKey, res.serverTime);
        } catch (err) {
          console.warn('[useMedicines] pull failed', err);
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: MED }); },
  });
}

export function useUpdateMedicine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) => repo.updateMedicine(id, patch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: MED }); },
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