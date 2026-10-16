import type { SupabaseClient } from '@supabase/supabase-js';

export const financeRepository = {
  async listAccounts(
    client: SupabaseClient,
    tenantId: string,
    params: {
      branchId?: string;
      startDate?: string;
      endDate?: string;
      entryType?: string;
      category?: string;
      page: number;
      pageSize: number;
    }
  ) {
    let q = client
      .from('accounts_book')
      .select(`
        *,
        recorded_by_user:users!accounts_book_recorded_by_fkey(full_name)
      `, { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (params.branchId) q = q.eq('branch_id', params.branchId);
    if (params.startDate) q = q.gte('entry_date', params.startDate);
    if (params.endDate) q = q.lte('entry_date', params.endDate);
    if (params.entryType) q = q.eq('entry_type', params.entryType);
    if (params.category) q = q.eq('category', params.category);

    const start = (params.page - 1) * params.pageSize;
    q = q.order('entry_date', { ascending: false }).order('created_at', { ascending: false }).range(start, start + params.pageSize - 1);

    const { data, error, count } = await q;
    if (error) throw error;
    return { rows: data, total: count || 0 };
  },

  async createAccountEntry(client: SupabaseClient, data: any) {
    const { data: row, error } = await client
      .from('accounts_book')
      .insert(data)
      .select('*')
      .single();
    if (error) throw error;
    return row;
  },

  async getCashClosing(client: SupabaseClient, tenantId: string, branchId: string, date: string) {
    const { data, error } = await client
      .from('cash_closing')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .eq('closing_date', date)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async upsertCashClosing(client: SupabaseClient, data: any) {
    const { data: row, error } = await client
      .from('cash_closing')
      .upsert(data, { onConflict: 'tenant_id,branch_id,closing_date' })
      .select('*')
      .single();
    if (error) throw error;
    return row;
  },

  async closeCashDay(client: SupabaseClient, id: string, closedBy: string) {
    const { data, error } = await client
      .from('cash_closing')
      .update({
        status: 'CLOSED',
        closed_by: closedBy,
        closed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'OPEN')
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },
};
