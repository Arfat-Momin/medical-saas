import { supabaseAdmin } from '../../config/supabase.js';

export const authRepository = {
  async signInWithPassword(email: string, password: string) {
    return supabaseAdmin.auth.signInWithPassword({ email, password });
  },

  async refreshSession(refreshToken: string) {
    return supabaseAdmin.auth.refreshSession({ refresh_token: refreshToken });
  },

  async signOut(accessToken: string) {
    const { error } = await supabaseAdmin.auth.admin.signOut(accessToken);
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
};
