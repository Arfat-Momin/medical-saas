import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../config/logger.js';

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

  async findLatestSubscriptionForTenant(
    client: SupabaseClient,
    tenantId: string,
  ) {
    // NOTE: deliberately NOT using .maybeSingle() here. Under load,
    // PostgREST sometimes returns {data:null,error:null} for maybeSingle
    // while a plain .limit(1) works. Use the array form + retries.
    let lastError: any = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const t0 = Date.now();
      const { data, error, status, statusText } = await client
        .from('subscriptions')
        .select('id, tenant_id, plan_id, status, starts_at, ends_at, is_free_tier, renewal_of_subscription_id, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(1);

      const ms = Date.now() - t0;
      const rowCount = Array.isArray(data) ? data.length : -1;

      // Visible in the backend console so we can see exactly what
      // Supabase returns on each attempt.
      logger.debug(
        { tenantId, attempt, ms, status, statusText, rowCount, errCode: error?.code ?? null, errMsg: error?.message ?? null },
        'subs-repo findLatestSubscriptionForTenant',
      );

      if (error) {
        lastError = error;
        await new Promise((r) => setTimeout(r, 200 * attempt));
        continue;
      }
      if (!Array.isArray(data) || data.length === 0) {
        await new Promise((r) => setTimeout(r, 200 * attempt));
        continue;
      }

      const sub = data[0] as any;

      let plan: any = null;
      if (sub.plan_id) {
        const { data: planRow, error: planErr } = await client
          .from('plans')
          .select('id, code, name, price_paise, billing_cycle, max_branches, max_users, is_free, trial_days, is_renewable')
          .eq('id', sub.plan_id)
          .limit(1);
        if (planErr) throw planErr;
        plan = Array.isArray(planRow) && planRow.length > 0 ? planRow[0] : null;
      }
      return { ...sub, plans: plan };
    }

    if (lastError) throw lastError;
    return null;
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

  /**
   * Extend an existing subscription in place.
   *
   * The `subscriptions_before_insert` trigger enforces one active
   * subscription per tenant, so renewal MUST update the existing row
   * rather than insert a new one.
   */
  async extendSubscription(
    client: SupabaseClient,
    subscriptionId: string,
    patch: { plan_id: string; status: string; ends_at: string; is_free_tier: boolean },
  ) {
    const { data, error } = await client
      .from('subscriptions')
      .update(patch)
      .eq('id', subscriptionId)
      .select('*')
      .single();
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




