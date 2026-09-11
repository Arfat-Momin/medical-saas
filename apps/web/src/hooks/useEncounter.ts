import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { opdRepository, type SaveEncounterInput } from '@/repositories/opd.repository';

const KEY = ['encounters'];

export function useEncounter(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => opdRepository.getEncounter(id!),
    enabled: Boolean(id),
  });
}

export function useSaveEncounter(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveEncounterInput) => opdRepository.saveEncounter(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, id] });
      qc.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}