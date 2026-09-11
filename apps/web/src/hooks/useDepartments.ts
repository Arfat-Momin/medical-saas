import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { departmentsRepository, type CreateDepartmentInput } from '@/repositories/departments.repository';

const KEY = ['departments'];

export function useDepartments(branchId?: string) {
  return useQuery({
    queryKey: [...KEY, branchId ?? 'all'],
    queryFn: () => departmentsRepository.list(branchId),
  });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDepartmentInput) => departmentsRepository.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}