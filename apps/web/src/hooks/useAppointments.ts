import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  appointmentsRepository,
  fetchDoctorInvoicesForAppointments,
  type CreateAppointmentInput,
} from '@/repositories/appointments.repository';
import { triggerSyncNow } from '@/sync/listeners';

import { useAuthStore } from '@/stores/auth.store';
const KEY = ['appointments'];

export function useAppointments(params: {
  date?: string;
  status?: string;
  patientId?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const tenantId = useAuthStore((s) => s.tenantId);
  return useQuery({
    queryKey: [...KEY, tenantId, params],
    enabled: !!tenantId,
    queryFn: async () => {
      // 1. Offline-first read from Dexie.
      const result = await appointmentsRepository.list(params);

      // 2. Hydrate DOCTOR invoice from the server when online.
      //    This is what surfaces `doctor_invoice` on the Appointments page.
      if (typeof navigator === 'undefined' || navigator.onLine !== false) {
        const serverIds = result.rows
          .map((r: any) => r.server_id)
          .filter((id: string | null): id is string => !!id);

        if (serverIds.length > 0) {
          const map = await fetchDoctorInvoicesForAppointments(serverIds);
          result.rows = result.rows.map((r: any) => ({
            ...r,
            doctor_invoice: r.server_id ? (map[r.server_id] ?? null) : null,
          })) as any;
        } else {
          result.rows = result.rows.map((r: any) => ({ ...r, doctor_invoice: null })) as any;
        }
      } else {
        // Offline — leave doctor_invoice undefined; the UI treats that as
        // "unknown" (same as null) and shows the neutral badge.
        result.rows = result.rows.map((r: any) => ({ ...r, doctor_invoice: null })) as any;
      }

      return result;
    },
    staleTime: 5_000,
  });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAppointmentInput) => {
      const result = await appointmentsRepository.create(input);
      await triggerSyncNow().catch(() => {});
      return result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await appointmentsRepository.checkIn(id);
      await triggerSyncNow().catch(() => {});
      return result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateAppointmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const result = await appointmentsRepository.updateStatus(id, status as any);
      await triggerSyncNow().catch(() => {});
      return result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}