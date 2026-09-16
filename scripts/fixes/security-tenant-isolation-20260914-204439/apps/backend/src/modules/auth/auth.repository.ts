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
   * Priority:
   *   1. First non-null branch_id on the user's active membership for this tenant.
   *   2. Fallback: the tenant's first active branch (alphabetical by branch_code).
   *
   * Returns null only if the tenant has no active branches at all.
   */
  async getPrimaryBranchForUser(userId: string, tenantId: string): Promise<string | null> {
    const { data: memberships, error: mErr } = await supabaseAdmin
      .from('memberships')
      .select('branch_id')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    if (mErr) throw mErr;

    const explicit = (memberships ?? [])
      .map((m: any) => m.branch_id)
      .find((id: string | null) => !!id);
    if (explicit) return explicit;

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
};