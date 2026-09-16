import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appointmentsRepository, type CreateAppointmentInput } from '@/repositories/appointments.repository';

const KEY = ['appointments'];

export function useAppointments(params: {
  date?: string;
  status?: string;
  patientId?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: () => appointmentsRepository.list(params),
    staleTime: 5_000,
  });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAppointmentInput) => appointmentsRepository.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => appointmentsRepository.checkIn(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateAppointmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      appointmentsRepository.updateStatus(id, status as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
