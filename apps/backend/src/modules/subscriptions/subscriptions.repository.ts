import type { SupabaseClient } from '@supabase/supabase-js';

export const subscriptionsRepository = {
  async listActivePlans(client: SupabaseClient) {
    const { data, error } = await client.from('plans')
      .select('*').eq('is_active', true).order('price_paise');
    if (error) throw error;
    return data ?? [];
  },

  async findPlanByCode(client: SupabaseClient, code: string) {
    const { data, error } = await client.from('plans').select('*').eq('code', code).maybeSingle();
    if (error) throw error;
    return data;
  },

  async findPlanById(client: SupabaseClient, id: string) {
    const { data, error } = await client.from('plans').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async findBySlug(client: SupabaseClient, slug: string) {
    const { data, error } = await client.from('pending_signups').select('*').eq('hospital_slug', slug).maybeSingle();
    if (error) throw error;
    return data;
  },

  async findByEmailPending(client: SupabaseClient, email: string) {
    const { data, error } = await client.from('pending_signups')
      .select('*').eq('email', email).in('status', ['PENDING', 'PAID']).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data;
  },

  async findAnyProvisionedByEmail(client: SupabaseClient, email: string) {
    const { data, error } = await client.from('pending_signups')
      .select('id, status, provisioned_tenant_id, subscription_type')
      .eq('email', email)
      .eq('status', 'PROVISIONED')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async createSignup(client: SupabaseClient, payload: Record<string, unknown>) {
    const { data, error } = await client.from('pending_signups').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  },

  async updateSignup(client: SupabaseClient, id: string, patch: Record<string, unknown>) {
    const { data, error } = await client.from('pending_signups').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },

  async findByOrderId(client: SupabaseClient, orderId: string) {
    const { data, error } = await client.from('pending_signups').select('*').eq('razorpay_order_id', orderId).maybeSingle();
    if (error) throw error;
    return data;
  },

  async findById(client: SupabaseClient, id: string) {
    const { data, error } = await client.from('pending_signups').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async provisionSignup(
    client: SupabaseClient,
    p: { signupId: string; paymentId: string; signature: string; webhook: unknown },
  ) {
    const { data, error } = await client.rpc('provision_signup', {
      p_signup_id: p.signupId,
      p_payment_id: p.paymentId,
      p_signature: p.signature,
      p_webhook: p.webhook,
    });
    if (error) throw error;
    return (Array.isArray(data) ? data[0] : data) as {
      alreadyProvisioned: boolean;
      tenantId: string;
      orgId?: string;
      branchId?: string;
      subscriptionId?: string;
    };
  },

  // -------- FREE TIER HELPERS --------

  async updateSubscriptionToFreeTrial(client: SupabaseClient, tenantId: string, endsAt: string) {
    const { data: subs, error: findErr } = await client
      .from('subscriptions')
      .select('id')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (findErr) throw findErr;
    if (!subs || subs.length === 0) return [];

    const { data, error } = await client
      .from('subscriptions')
      .update({ is_free_tier: true, ends_at: endsAt })
      .eq('id', subs[0]!.id)
      .select('*');
    if (error) throw error;
    return data ?? [];
  },

  async deleteDummyPayment(client: SupabaseClient, tenantId: string, paymentId: string) {
    await client
      .from('subscription_payments')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('razorpay_payment_id', paymentId);
  },

  // -------- RENEWAL --------

  async findLatestSubscriptionForTenant(client: SupabaseClient, tenantId: string) {
    const { data, error } = await client
      .from('subscriptions')
      .select('*, plans:plan_id ( id, code, name, price_paise, billing_cycle, max_branches, max_users, is_free, trial_days, is_renewable )')
      .eq('tenant_id', tenantId)
      .order('ends_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async createPendingRenewal(client: SupabaseClient, payload: Record<string, unknown>) {
    const { data, error } = await client.from('pending_renewals').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  },

  async findPendingRenewalById(client: SupabaseClient, id: string) {
    const { data, error } = await client.from('pending_renewals').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async findPendingRenewalByOrderId(client: SupabaseClient, orderId: string) {
    const { data, error } = await client.from('pending_renewals').select('*').eq('razorpay_order_id', orderId).maybeSingle();
    if (error) throw error;
    return data;
  },

  async findExistingPendingRenewal(client: SupabaseClient, tenantId: string) {
    const { data, error } = await client
      .from('pending_renewals')
      .select('id, razorpay_order_id, created_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async updatePendingRenewal(client: SupabaseClient, id: string, patch: Record<string, unknown>) {
    const { data, error } = await client.from('pending_renewals').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },

  async createSubscription(client: SupabaseClient, payload: Record<string, unknown>) {
    const { data, error } = await client.from('subscriptions').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  },

  async createSubscriptionPayment(client: SupabaseClient, payload: Record<string, unknown>) {
    const { data, error } = await client.from('subscription_payments').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  },

  async listRecentPayments(client: SupabaseClient, tenantId: string, limit = 10) {
    const { data, error } = await client
      .from('subscription_payments')
      .select('id, amount_paise, currency, status, razorpay_payment_id, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  async ensureTenantActive(client: SupabaseClient, tenantId: string) {
    await client.from('tenants').update({ status: 'ACTIVE' }).eq('id', tenantId);
  },
};
