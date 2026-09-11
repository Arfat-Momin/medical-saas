import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { organizationsRepository, type UpdateOrganizationInput } from '@/repositories/organizations.repository';

const KEY = ['organization'];

export function useOrganization() {
  return useQuery({ queryKey: KEY, queryFn: organizationsRepository.getMine });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateOrganizationInput) => organizationsRepository.updateMine(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}