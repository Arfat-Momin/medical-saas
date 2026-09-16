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
      // Consultation completion auto-creates the encounter's invoice
      qc.invalidateQueries({ queryKey: ['billing', 'invoices'] });
      qc.invalidateQueries({ queryKey: ['encounters'] });
    },
  });
}

/**
 * Admin-only: fetch an encounter straight from the server by server_id.
 * No Dexie fallback — if the encounter hasn't synced, the admin cannot edit it.
 */
export function useAdminEncounter(serverId: string | undefined) {
  return useQuery({
    queryKey: ['admin-encounter', serverId],
    queryFn: () => opdRepository.getEncounter(serverId!),
    enabled: Boolean(serverId),
    staleTime: 5_000,
  });
}

/** Admin-only: save prescription changes and mirror them into Dexie. */
export function useAdminEditPrescription(serverId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminEditPrescriptionInput) =>
      opdRepository.adminEditPrescription(serverId, input),

    onSuccess: async (enc) => {
      // The server returns snake_case; translate back into local shape so
      // the regular ConsultationPage shows the corrected data without
      // needing a full re-sync.
      const s = enc as unknown as ServerEncounter;
      const localDiagnoses = (s.diagnoses ?? []).map((d: any) => ({
        diagnosisText: d.diagnosis_text,
        icdCode:       d.icd_code ?? null,
        notes:         d.notes ?? null,
        isPrimary:     !!d.is_primary,
      }));
      const localPrescription = s.prescription
        ? {
            notes: s.prescription.notes ?? null,
            items: (s.prescription.items ?? []).map((it: any) => ({
              medicineName: it.medicine_name,
              dosage:       it.dosage ?? null,
              frequency:    it.frequency ?? null,
              duration:     it.duration ?? null,
              route:        it.route ?? null,
              instructions: it.instructions ?? null,
              quantity:     it.quantity != null ? String(it.quantity) : null,
            })),
          }
        : null;

      await encountersRepository
        .applyServerPatch(serverId, {
          prescription: localPrescription,
          diagnoses: localDiagnoses,
        })
        .catch(() => {});

      qc.invalidateQueries({ queryKey: ['admin-encounter', serverId] });
      qc.invalidateQueries({ queryKey: ['server-encounter', serverId] });
      qc.invalidateQueries({ queryKey: ['patient-encounters'] });
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
