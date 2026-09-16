import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import {
  patientsRepository,
  type CreatePatientInput,
  type ListPatientsResponse,
  type Patient,
} from '@/repositories/patients.repository';

const KEY = ['patients'];

export interface UsePatientsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  branchId?: string;
}

export function usePatients(params: UsePatientsParams = {}) {
  const tenantId = useAuthStore((s) => s.tenantId);
  return useQuery<ListPatientsResponse>({
    queryKey: [...KEY, tenantId, params],
    enabled: !!tenantId,
    queryFn: () => patientsRepository.list(params),
    staleTime: 5_000,
  });
}

export function usePatient(id: string | undefined) {
  return useQuery<Patient>({
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
