import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rolesRepository } from '@/repositories/roles.repository';

const KEY = ['roles'];

export function useRoles() {
  return useQuery({ queryKey: KEY, queryFn: rolesRepository.list });
}

export function useUpdateRolePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, permissions }: { id: string; permissions: string[] }) =>
      rolesRepository.updatePermissions(id, permissions),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}