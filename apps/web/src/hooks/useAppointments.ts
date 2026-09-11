import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appointmentsRepository, type CreateAppointmentInput } from '@/repositories/appointments.repository';

const KEY = ['appointments'];

export function useAppointments(params: { date?: string; doctorId?: string; status?: string; page?: number; pageSize?: number }) {
  return useQuery({ queryKey: [...KEY, params], queryFn: () => appointmentsRepository.list(params) });
}

export function useTodayAppointments(date?: string) {
  return useQuery({ queryKey: [...KEY, 'today', date], queryFn: () => appointmentsRepository.today(date) });
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

export function useStartEncounter() {
  return useMutation({ mutationFn: (id: string) => appointmentsRepository.start(id) });
}