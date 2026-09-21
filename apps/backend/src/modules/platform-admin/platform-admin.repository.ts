import type { SupabaseClient } from '@supabase/supabase-js';

const TENANT_SELECT = `
  id, tenant_code, name, slug, type, status, contact_email, contact_phone,
  created_at, updated_at
`;

export const platformAdminRepository = {
  // ---- Tenants ----
  async listTenants(client: SupabaseClient, opts: { search?: string; status?: string; page: number; pageSize: number }) {
    const from = (opts.page - 1) * opts.pageSize;
    const to = from + opts.pageSize - 1;

    let q = client.from('tenants').select(TENANT_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (opts.status) q = q.eq('status', opts.status);
    if (opts.search) {
      const s = opts.search.replace(/[,%_]/g, '');
      q = q.or(`name.ilike.%${s}%,tenant_code.ilike.%${s}%,slug.ilike.%${s}%`);
    }

    const { data, error, count } = await q.range(from, to);
    if (error) throw error;

    // Hydrate each with its latest subscription + plan
    const tenantIds = (data ?? []).map((t: any) => t.id);
    let subsByTenant: Record<string, any> = {};
    if (tenantIds.length > 0) {
      const { data: subs } = await client
        .from('subscriptions')
        .select('id, tenant_id, status, starts_at, ends_at, plans:plan_id ( id, code, name, price_paise, billing_cycle )')
        .in('tenant_id', tenantIds)
        .order('created_at', { ascending: false });
      (subs ?? []).forEach((s: any) => {
        if (!subsByTenant[s.tenant_id]) subsByTenant[s.tenant_id] = s;
      });
    }

    const rows = (data ?? []).map((t: any) => ({
      ...t,
      latest_subscription: subsByTenant[t.id] ?? null,
    }));

    return { rows, total: count ?? 0, page: opts.page, pageSize: opts.pageSize };
  },

  async findTenantById(client: SupabaseClient, id: string) {
    const { data, error } = await client.from('tenants').select(TENANT_SELECT).eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async findTenantFull(client: SupabaseClient, id: string) {
    const tenant = await platformAdminRepository.findTenantById(client, id);
    if (!tenant) return null;

    const { data: subs } = await client
      .from('subscriptions')
      .select('id, tenant_id, status, starts_at, ends_at, razorpay_subscription_id, created_at, plans:plan_id ( id, code, name, price_paise, billing_cycle, max_branches, max_users )')
      .eq('tenant_id', id)
      .order('created_at', { ascending: false });

    const { data: payments } = await client
      .from('subscription_payments')
      .select('id, amount_paise, currency, status, razorpay_order_id, razorpay_payment_id, created_at')
      .eq('tenant_id', id)
      .order('created_at', { ascending: false });

    // Deliberately: NO query against patients, invoices, encounters, etc.
    return { ...tenant, subscriptions: subs ?? [], payments: payments ?? [] };
  },

  async updateTenant(client: SupabaseClient, id: string, patch: Record<string, unknown>) {
    const { data, error } = await client.from('tenants').update(patch).eq('id', id).select(TENANT_SELECT).single();
    if (error) throw error;
    return data;
  },

  // ---- Subscriptions ----
  async findLatestSubscription(client: SupabaseClient, tenantId: string) {
    const { data, error } = await client.from('subscriptions')
      .select('*').eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data;
  },

  async extendSubscription(client: SupabaseClient, subscriptionId: string, newEndsAt: string) {
    const { data, error } = await client.from('subscriptions')
      .update({ ends_at: newEndsAt, status: 'ACTIVE' })
      .eq('id', subscriptionId).select('*').single();
    if (error) throw error;
    return data;
  },

  // ---- Plans ----
  async listPlans(client: SupabaseClient, activeOnly = false) {
    let q = client.from('plans').select('*').order('price_paise');
    if (activeOnly) q = q.eq('is_active', true);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async findPlan(client: SupabaseClient, id: string) {
    const { data, error } = await client.from('plans').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async createPlan(client: SupabaseClient, payload: Record<string, unknown>) {
    const { data, error } = await client.from('plans').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  },

  async updatePlan(client: SupabaseClient, id: string, patch: Record<string, unknown>) {
    const { data, error } = await client.from('plans').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },

  // ---- Dashboard stats ----
  async dashboardStats(client: SupabaseClient) {
    const { count: totalTenants } = await client.from('tenants')
      .select('*', { count: 'exact', head: true });

    const { count: activeCount } = await client.from('tenants')
      .select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE');

    const { count: trialCount } = await client.from('tenants')
      .select('*', { count: 'exact', head: true }).eq('status', 'TRIAL');

    const { count: suspendedCount } = await client.from('tenants')
      .select('*', { count: 'exact', head: true }).eq('status', 'SUSPENDED');

    // Subscriptions expiring in the next 30 days
    const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: expiringSoon } = await client.from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ACTIVE')
      .lte('ends_at', in30)
      .gte('ends_at', new Date().toISOString());

    // Total revenue in paise (sum of captured payments)
    const { data: revenueRows } = await client.from('subscription_payments')
      .select('amount_paise').eq('status', 'CAPTURED');
    const totalRevenuePaise = (revenueRows ?? []).reduce((s: number, r: any) => s + (r.amount_paise ?? 0), 0);

    return {
      totalTenants: totalTenants ?? 0,
      active:       activeCount ?? 0,
      trial:        trialCount ?? 0,
      suspended:    suspendedCount ?? 0,
      expiringSoon: expiringSoon ?? 0,
      totalRevenuePaise,
    };
  },

  async expiringSoon(client: SupabaseClient, days = 30) {
    const soon = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await client.from('subscriptions')
      .select(`
        id, tenant_id, status, ends_at,
        tenants:tenant_id ( id, tenant_code, name ),
        plans:plan_id ( code, name )
      `)
      .eq('status', 'ACTIVE')
      .lte('ends_at', soon)
      .gte('ends_at', new Date().toISOString())
      .order('ends_at');
    if (error) throw error;
    return data ?? [];
  },
};
