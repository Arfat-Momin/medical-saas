import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { branchesRepository, type CreateBranchInput, type UpdateBranchInput } from '@/repositories/branches.repository';
import { branchesLocalRepository } from '@/repositories/offline.repositories';
import { db } from '@/db';
import { syncEngine } from '@/sync/engine';

const KEY = ['branches'];

export function useBranches(activeOnly = true) {
  return useQuery({
    queryKey: [...KEY, activeOnly],
    queryFn: async () => {
      const online = typeof navigator !== 'undefined' && navigator.onLine !== false;
      const localCount = await db.branches.count();
      if (online && localCount === 0) {
        try { await syncEngine.pull(); } catch { /* best effort */ }
      } else if (online) {
        syncEngine.pull().catch(() => {});
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      syncEngine.pull().catch(() => {});
    },
  });
}

export function useUpdateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateBranchInput }) => branchesRepository.update(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      syncEngine.pull().catch(() => {});
    },
  });
}