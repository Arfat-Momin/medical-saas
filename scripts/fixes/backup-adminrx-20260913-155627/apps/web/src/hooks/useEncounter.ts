import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  encountersRepository,
  type SaveEncounterInput,
} from '@/repositories/encounters.repository';
import {
  opdRepository,
  type AdminEditPrescriptionInput,
  type Encounter as ServerEncounter,
} from '@/repositories/opd.repository';

const KEY = ['encounters'];

export function useEncounter(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => encountersRepository.getById(id!),
    enabled: Boolean(id),
    staleTime: 5_000,
  });
}

export function useSaveEncounter(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveEncounterInput) => encountersRepository.save(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, id] });
      qc.invalidateQueries({ queryKey: ['appointments'] });
      qc.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}
