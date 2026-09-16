import { supabaseAdmin } from '../../config/supabase.js';

export const authRepository = {
  async signInWithPassword(email: string, password: string) {
    return supabaseAdmin.auth.signInWithPassword({ email, password });
  },

  async refreshSession(refreshToken: string) {
    return supabaseAdmin.auth.refreshSession({ refresh_token: refreshToken });
  },

  async signOut(accessToken: string) {
    const { error } = await supabaseAdmin.auth.admin.signOut(accessToken, 'local');
    return { error };
  },

  async signOutAll(accessToken: string) {
    const { error } = await supabaseAdmin.auth.admin.signOut(accessToken, 'global');
    return { error };
  },

  async getUserProfile(userId: string) {
    const { data } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, phone, is_platform_admin, is_active')
      .eq('id', userId)
      .maybeSingle();
    return data;
  },

  async listDevices(userId: string) {
    const { data, error } = await supabaseAdmin
      .from('devices')
      .select('id, device_id, platform, app_version, os_version, last_seen_at, created_at')
      .eq('user_id', userId)
      .order('last_seen_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async revokeDevice(userId: string, deviceId: string) {
    const { error } = await supabaseAdmin
      .from('devices')
      .delete()
      .eq('user_id', userId)
      .eq('device_id', deviceId);
    if (error) throw error;
  },

  /**
   * Resolve the branch a user should "act in" by default.
   *
   * SECURITY FIX:
   *   The previous version fell back to the tenant's first active branch
   *   even when the user had NO active membership in the tenant. That
   *   leaked a valid branch id to a non-member.
   *
   * New behaviour:
   *   1. If the user has at least one active membership, use the first
   *      non-null branch_id from those memberships.
   *   2. Otherwise, fall back to the tenant's first active branch ONLY
   *      when the user is an active member of that tenant.
   *   3. If the user has no active membership in the tenant → return
   *      null. Do NOT leak the tenant's default branch.
   */
  async getPrimaryBranchForUser(userId: string, tenantId: string): Promise<string | null> {
    const { data: memberships, error: mErr } = await supabaseAdmin
      .from('memberships')
      .select('branch_id')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    if (mErr) throw mErr;

    // 3. No active membership → no branch context. Never fall back.
    if (!memberships || memberships.length === 0) return null;

    const explicit = memberships
      .map((m: any) => m.branch_id)
      .find((id: string | null) => !!id);
    if (explicit) return explicit;

    // Active member, no branch assigned → default to tenant's first branch.
    const { data: branch, error: bErr } = await supabaseAdmin
      .from('branches')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('branch_code')
      .limit(1)
      .maybeSingle();
    if (bErr) throw bErr;
    return branch?.id ?? null;
  },

  /**
   * Return the first active tenant membership for a user, or null.
   * Used by Google OAuth login to decide whether the user still needs
   * to complete the signup flow.
   */
  async findActiveMembership(userId: string): Promise<{ tenant_id: string } | null> {
    const { data } = await supabaseAdmin
      .from('memberships')
      .select('tenant_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    return (data as { tenant_id: string } | null) ?? null;
  },
};