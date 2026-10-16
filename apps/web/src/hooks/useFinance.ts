import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { financeRepository } from '@/repositories/finance.repository';
import type { CreateAccountEntryInput } from '@/repositories/finance.repository';

const ACCOUNTS = ['finance', 'accounts'];
const CLOSING  = ['finance', 'cash-closing'];

export function useAccounts(params: {
  branchId?: string;
  startDate?: string;
  endDate?: string;
  entryType?: string;
  category?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  return useQuery({
    queryKey: [...ACCOUNTS, params],
    queryFn: () => financeRepository.listAccounts(params),
  });
}

export function useCreateAccountEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAccountEntryInput) => financeRepository.createAccountEntry(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ACCOUNTS });
      qc.invalidateQueries({ queryKey: CLOSING });
    },
  });
}

export function useCashClosing(branchId: string | undefined, date: string) {
  return useQuery({
    queryKey: [...CLOSING, branchId, date],
    queryFn: () => financeRepository.getCashClosing(branchId!, date),
    enabled: Boolean(branchId) && Boolean(date),
  });
}

export function useUpdateCashClosing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { branchId: string; closingDate: string; actualCash: number; notes?: string | null }) =>
      financeRepository.updateCashClosing(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLOSING }),
  });
}

export function useCloseCashDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financeRepository.closeCashDay(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLOSING }),
  });
}
