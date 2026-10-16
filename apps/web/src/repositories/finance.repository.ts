import { api } from '@/lib/api';

export interface AccountEntry {
  id: string;
  tenant_id: string;
  branch_id: string;
  entry_type: 'INCOME' | 'EXPENSE' | 'REFUND' | 'ADJUSTMENT';
  category: string;
  description: string;
  amount: number;
  payment_mode: string;
  coverage_type: string | null;
  reference_no: string | null;
  source_table: string | null;
  source_id: string | null;
  balance: number | null;
  recorded_by: string | null;
  entry_date: string;
  entry_time: string;
  created_at: string;
  recorded_by_user?: { full_name: string } | null;
}

export interface CashClosing {
  id: string;
  tenant_id: string;
  branch_id: string;
  closing_date: string;
  opening_balance: number;
  cash_receipts: number;
  cash_expenses: number;
  cash_refunds: number;
  expected_cash: number;
  actual_cash: number | null;
  difference: number | null;
  notes: string | null;
  closed_by: string | null;
  closed_at: string | null;
  status: 'OPEN' | 'CLOSED';
  created_at: string;
}

export interface CreateAccountEntryInput {
  branchId: string;
  entryType: 'INCOME' | 'EXPENSE' | 'REFUND' | 'ADJUSTMENT';
  category: string;
  description: string;
  amount: number;
  paymentMode: string;
  coverageType?: string | null;
  referenceNo?: string | null;
  entryDate?: string;
}

export const financeRepository = {
  listAccounts: (params: {
    branchId?: string;
    startDate?: string;
    endDate?: string;
    entryType?: string;
    category?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    return api.get<{ rows: AccountEntry[]; total: number }>(`/finance/accounts?${qs.toString()}`);
  },

  createAccountEntry: (input: CreateAccountEntryInput) =>
    api.post<AccountEntry>('/finance/accounts', input),

  getCashClosing: (branchId: string, date: string) =>
    api.get<CashClosing>(`/finance/cash-closing?branchId=${branchId}&date=${date}`),

  updateCashClosing: (input: { branchId: string; closingDate: string; actualCash: number; notes?: string | null }) =>
    api.post<CashClosing>('/finance/cash-closing', input),

  closeCashDay: (id: string) =>
    api.patch<CashClosing>(`/finance/cash-closing/${id}/close`, {}),
};
