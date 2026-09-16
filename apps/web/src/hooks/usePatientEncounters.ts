import { useQuery } from '@tanstack/react-query';
import { patientEncountersRepository } from '@/repositories/patient-encounters.repository';

export function usePatientEncounters(patientId: string | undefined) {
  return useQuery({
    queryKey: ['patient-encounters', patientId],
    queryFn: () => patientEncountersRepository.listForPatient(patientId!),
    enabled: Boolean(patientId),
    staleTime: 10_000,
  });
}

export function useServerEncounter(id: string | undefined) {
  return useQuery({
    queryKey: ['server-encounter', id],
    queryFn: () => patientEncountersRepository.getById(id!),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}
