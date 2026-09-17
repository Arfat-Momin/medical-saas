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

  async findBySlug(client: SupabaseClient, slug: string) {
    const { data, error } = await client.from('pending_signups').select('*').eq('hospital_slug', slug).maybeSingle();
    if (error) throw error;
    return data;
  },

  async findByEmailPending(client: SupabaseClient, email: string) {
    const { data, error } = await client.from('pending_signups')
      .select('*').eq('email', email).in('status', ['PENDING','PAID']).maybeSingle();
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
};
