import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { branchesRepository, type CreateBranchInput, type UpdateBranchInput } from '@/repositories/branches.repository';
import { branchesLocalRepository } from '@/repositories/offline.repositories';
import { db } from '@/db';
import { syncEngine } from '@/sync/engine';
import { useAuthStore } from '@/stores/auth.store';

const KEY = ['branches'];

export function useBranches(activeOnly = true) {
  const tenantId = useAuthStore((s) => s.tenantId);

  return useQuery({
    queryKey: [...KEY, tenantId, activeOnly],
    enabled: !!tenantId,
    queryFn: async () => {
      if (!tenantId) return [];

      const online = typeof navigator !== 'undefined' && navigator.onLine !== false;
      if (online) {
        // Await the pull only when the local cache is empty, so the very
        // first render already has data. Otherwise refresh in the
        // background to avoid a synchronous network round-trip on every
        // filter change.
        const localCount = await db.branches
          .where('tenant_id').equals(tenantId).count();
        if (localCount === 0) {
          try { await syncEngine.pullEntity('branches'); } catch { /* best effort */ }
        } else {
          void syncEngine.pullEntity('branches').catch(() => {});
        }
      }

      return branchesLocalRepository.list(activeOnly);
    },
    staleTime: 30_000,
  });
}

export function useCreateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBranchInput) => branchesRepository.create(input),
    onSuccess: async () => {
      // The server now has the new branch. Pull it into Dexie before
      // re-reading so the list renders it on the next tick.
      try { await syncEngine.pullEntity('branches'); } catch { /* best effort */ }
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useUpdateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateBranchInput }) => branchesRepository.update(id, patch),
    onSuccess: async () => {
      try { await syncEngine.pullEntity('branches'); } catch { /* best effort */ }
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}