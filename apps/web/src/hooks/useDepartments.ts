import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { departmentsRepository, type CreateDepartmentInput } from '@/repositories/departments.repository';
import { readData } from '@/lib/dataService';

const KEY = ['departments'];

export function useDepartments(branchId?: string) {
  return useQuery({
    queryKey: [...KEY, branchId ?? 'all'],
    queryFn: () =>
      readData(
        () => departmentsRepository.list(branchId),
        () => Promise.resolve([] as Awaited<ReturnType<typeof departmentsRepository.list>>),
        `departments-${branchId ?? 'all'}`,
        60_000, // 60s cache for reference data
      ),
    staleTime: 60_000,
  });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDepartmentInput) => departmentsRepository.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}