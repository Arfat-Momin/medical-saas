import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersRepository, type InviteUserInput } from '@/repositories/users.repository';

const KEY = ['users'];

export interface UseUsersParams {
  page?: number;
  pageSize?: number;
  branchId?: string;
  roleCode?: string;
  search?: string;
}

export function useUsers(params: UseUsersParams) {
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: () => usersRepository.list(params),
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
