import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersRepository, type InviteUserInput } from '@/repositories/users.repository';
import { readData } from '@/lib/dataService';

const KEY = ['users'];

export interface UseUsersParams {
  page?: number;
  pageSize?: number;
  branchId?: string;
  roleCode?: string;
  search?: string;
}

export function useUsers(params: UseUsersParams) {
  const cacheKey = `users-${JSON.stringify(params)}`;
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: () =>
      readData(
        () => usersRepository.list(params),
        () => Promise.resolve({ rows: [], total: 0, page: params.page ?? 1, pageSize: params.pageSize ?? 20 } as Awaited<ReturnType<typeof usersRepository.list>>),
        cacheKey,
        30_000,
      ),
    staleTime: 30_000,
  });
}

export function useInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InviteUserInput) => usersRepository.invite(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { fullName?: string; phone?: string | null; isActive?: boolean; consultationFee?: number } }) =>
      usersRepository.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
