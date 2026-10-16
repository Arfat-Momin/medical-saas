import { supabaseForUser } from '../../config/supabase.js';
import { financeRepository as repo } from './finance.repository.js';
import { NotFound } from '../../utils/errors.js';
import { audit } from '../../middleware/audit.js';
import type { AuthContext } from '@medical/shared';
import * as schemas from './finance.validators.js';

export const financeService = {
  async listAccounts(auth: AuthContext, token: string, query: any) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const params = schemas.listAccountsSchema.parse(query);
    const client = supabaseForUser(token);
    return repo.listAccounts(client, auth.tenantId, params);
  },

  async createAccountEntry(auth: AuthContext, token: string, body: any) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const data = schemas.createAccountEntrySchema.parse(body);
    const client = supabaseForUser(token);
    const row = await repo.createAccountEntry(client, {
      tenant_id: auth.tenantId,
      branch_id: data.branchId,
      entry_type: data.entryType,
      category: data.category,
      description: data.description,
      amount: data.amount,
      payment_mode: data.paymentMode,
      coverage_type: data.coverageType ?? null,
      reference_no: data.referenceNo ?? null,
      recorded_by: auth.userId,
      entry_date: data.entryDate ?? new Date().toISOString().split('T')[0],
    });
    await audit({ actorUserId: auth.userId, action: 'ACCOUNT_ENTRY_CREATED', entity: 'accounts_book', entityId: row.id, after: row });
    return row;
  },

  async getCashClosing(auth: AuthContext, token: string, branchId: string, date: string) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);

    // Compute real cash from accounts_book for the requested day
    const { data: accounts } = await client
      .from('accounts_book')
      .select('amount, entry_type, payment_mode')
      .eq('tenant_id', auth.tenantId)
      .eq('branch_id', branchId)
      .eq('entry_date', date)
      .eq('payment_mode', 'CASH');

    let cashReceipts = 0;
    let cashExpenses = 0;
    let cashRefunds = 0;

    if (accounts) {
      for (const acc of accounts as any[]) {
        const amt = Number(acc.amount);
        if (acc.entry_type === 'INCOME') cashReceipts += amt;
        if (acc.entry_type === 'EXPENSE') cashExpenses += amt;
        if (acc.entry_type === 'REFUND') cashRefunds += amt;
      }
    }

    let closing = await repo.getCashClosing(client, auth.tenantId, branchId, date);

    if (closing && closing.status === 'OPEN') {
      // Update running totals while open
      closing = await repo.upsertCashClosing(client, {
        id: closing.id,
        tenant_id: auth.tenantId,
        branch_id: branchId,
        closing_date: date,
        opening_balance: closing.opening_balance,
        cash_receipts: cashReceipts,
        cash_expenses: cashExpenses,
        cash_refunds: cashRefunds,
      });
    } else if (!closing) {
      // Create fresh record
      closing = await repo.upsertCashClosing(client, {
        tenant_id: auth.tenantId,
        branch_id: branchId,
        closing_date: date,
        cash_receipts: cashReceipts,
        cash_expenses: cashExpenses,
        cash_refunds: cashRefunds,
      });
    }

    return closing;
  },

  async updateCashClosing(auth: AuthContext, token: string, body: any) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const data = schemas.createCashClosingSchema.parse(body);
    const client = supabaseForUser(token);
    const row = await repo.upsertCashClosing(client, {
      tenant_id: auth.tenantId,
      branch_id: data.branchId,
      closing_date: data.closingDate,
      actual_cash: data.actualCash,
      notes: data.notes ?? null,
    });
    return row;
  },

  async closeCashDay(auth: AuthContext, token: string, id: string) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const row = await repo.closeCashDay(client, id, auth.userId);
    await audit({ actorUserId: auth.userId, action: 'CASH_DAY_CLOSED', entity: 'cash_closing', entityId: id, after: row });
    return row;
  },
};
