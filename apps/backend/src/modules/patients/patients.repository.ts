import type { SupabaseClient } from '@supabase/supabase-js';

export const patientsRepository = {
  async nextUHID(client: SupabaseClient, tenantId: string): Promise<string> {
    const { data, error } = await client.rpc('next_uhid', { p_tenant: tenantId });
    if (error) throw error;
    return data as string;
  },

  async list(
    client: SupabaseClient,
    tenantId: string,
    opts: { page: number; pageSize: number; search?: string; branchId?: string },
  ) {
    const from = (opts.page - 1) * opts.pageSize;
    const to = from + opts.pageSize - 1;

    let q = client
      .from('patients')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (opts.branchId) q = q.eq('branch_id', opts.branchId);

    if (opts.search && opts.search.trim()) {
      const s = opts.search.trim().replace(/[,%]/g, '');
      q = q.or(`full_name.ilike.%${s}%,mobile.ilike.%${s}%,uhid.ilike.%${s}%`);
    }

    const { data, error, count } = await q.range(from, to);
    if (error) throw error;

    return {
      rows: data ?? [],
      total: count ?? 0,
      page: opts.page,
      pageSize: opts.pageSize,
    };
  },

  async findById(client: SupabaseClient, tenantId: string, id: string) {
    const { data, error } = await client
      .from('patients')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async findByUHID(client: SupabaseClient, tenantId: string, uhid: string) {
    const { data, error } = await client
      .from('patients')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('uhid', uhid)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async findDuplicates(
    client: SupabaseClient,
    tenantId: string,
    input: { mobile?: string; fullName?: string; dateOfBirth?: string },
  ) {
    const matches: any[] = [];

    if (input.mobile) {
      const { data } = await client
        .from('patients')
        .select('id, uhid, full_name, mobile, date_of_birth')
        .eq('tenant_id', tenantId)
        .eq('mobile', input.mobile)
        .limit(5);
      if (data) matches.push(...data.map((p) => ({ ...p, reason: 'same_mobile' })));
    }

    if (input.fullName && input.dateOfBirth) {
      const { data } = await client
        .from('patients')
        .select('id, uhid, full_name, mobile, date_of_birth')
        .eq('tenant_id', tenantId)
        .eq('full_name', input.fullName)
        .eq('date_of_birth', input.dateOfBirth)
        .limit(5);
      if (data) matches.push(...data.map((p) => ({ ...p, reason: 'same_name_dob' })));
    }

    // Dedupe by id (a patient may match on both criteria)
    const map = new Map<string, any>();
    matches.forEach((m) => { if (!map.has(m.id)) map.set(m.id, m); });
    return Array.from(map.values());
  },

  async create(client: SupabaseClient, payload: Record<string, unknown>) {
    const { data, error } = await client.from('patients').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  },

  async update(client: SupabaseClient, tenantId: string, id: string, patch: Record<string, unknown>) {
    const { data, error } = await client
      .from('patients')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async findDefaultBranch(client: SupabaseClient, tenantId: string) {
    const { data, error } = await client
      .from('branches')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('branch_code')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
};