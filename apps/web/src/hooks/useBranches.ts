import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { branchesRepository, type CreateBranchInput, type UpdateBranchInput } from '@/repositories/branches.repository';

const KEY = ['branches'];

export function useBranches(activeOnly = true) {
  return useQuery({ queryKey: [...KEY, activeOnly], queryFn: () => branchesRepository.list(activeOnly) });
}

export function useCreateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBranchInput) => branchesRepository.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateBranchInput }) =>
      branchesRepository.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}