import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ipdRepository as repo } from '@/repositories/ipd.repository';

const LOCS = ['ipd', 'locations'];
const BEDS = ['ipd', 'beds'];
const ADMS = ['ipd', 'admissions'];

// ---- Locations ----
export function useLocations(params: { branchId?: string; parentId?: string; type?: string } = {}) {
  return useQuery({ queryKey: [...LOCS, params], queryFn: () => repo.listLocations(params) });
}
export function useCreateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: repo.createLocation,
    onSuccess: () => { qc.invalidateQueries({ queryKey: LOCS }); qc.invalidateQueries({ queryKey: BEDS }); },
  });
}
export function useUpdateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) => repo.updateLocation(id, patch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: LOCS }); qc.invalidateQueries({ queryKey: BEDS }); },
  });
}

export function useDeleteLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo.deleteLocation(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: LOCS }); qc.invalidateQueries({ queryKey: BEDS }); },
  });
}

// ---- Beds ----
export function useBeds(branchId?: string) {
  return useQuery({ queryKey: [...BEDS, branchId ?? 'all'], queryFn: () => repo.listBeds(branchId) });
}

// ---- Admissions ----
export function useAdmissions(params: { status?: string; patientId?: string; page?: number; pageSize?: number }) {
  return useQuery({ queryKey: [...ADMS, params], queryFn: () => repo.listAdmissions(params) });
}
export function useAdmission(id: string | undefined) {
  return useQuery({ queryKey: [...ADMS, id], queryFn: () => repo.getAdmission(id!), enabled: Boolean(id) });
}
export function useAdmit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: repo.admit,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ADMS }); qc.invalidateQueries({ queryKey: BEDS }); },
  });
}
export function useTransferBed(admissionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { toBedId: string; reason: string }) => repo.transfer(admissionId, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ADMS }); qc.invalidateQueries({ queryKey: BEDS }); qc.invalidateQueries({ queryKey: [...ADMS, admissionId] }); },
  });
}
export function useDischarge(admissionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { dischargeType: string; dischargeSummary?: string | null }) => repo.discharge(admissionId, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ADMS }); qc.invalidateQueries({ queryKey: BEDS }); qc.invalidateQueries({ queryKey: [...ADMS, admissionId] }); },
  });
}

// ---- Clinical notes / rounds / MAR ----
export function useAddNursingNote(admissionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { noteType: string; note: string }) => repo.createNursingNote(admissionId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...ADMS, admissionId] }),
  });
}
export function useAddDoctorRound(admissionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { clinicalNotes?: string | null; assessment?: string | null; plan?: string | null }) => repo.createDoctorRound(admissionId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...ADMS, admissionId] }),
  });
}
export function useAddMar(admissionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { medicationName: string; dose?: string | null; route?: string | null; scheduledAt: string; notes?: string | null }) => repo.createMar(admissionId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...ADMS, admissionId] }),
  });
}
export function useMarkMar(admissionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ marId, status, notes }: { marId: string; status: string; notes?: string | null }) =>
      repo.markMar(marId, { status, notes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...ADMS, admissionId] }),
  });
}
