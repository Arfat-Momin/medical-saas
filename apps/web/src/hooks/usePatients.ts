import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { patientsRepository, type CreatePatientInput } from '@/repositories/patients.repository';

const KEY = ['patients'];

export interface UsePatientsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  branchId?: string;
}

export function usePatients(params: UsePatientsParams) {
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: () => patientsRepository.list(params),
  });
}

export function usePatient(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => patientsRepository.getById(id!),
    enabled: Boolean(id),
  });
}

export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePatientInput) => patientsRepository.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<CreatePatientInput> }) =>
      patientsRepository.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}