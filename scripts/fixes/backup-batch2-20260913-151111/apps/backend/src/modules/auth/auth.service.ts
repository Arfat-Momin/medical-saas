import { authRepository } from './auth.repository.js';
import { BadRequest, Forbidden, Unauthorized } from '../../utils/errors.js';
import { audit } from '../../middleware/audit.js';
import { supabaseAdmin } from '../../config/supabase.js';

export const authService = {
  async login(email: string, password: string) {
    const { data, error } = await authRepository.signInWithPassword(email, password);
    if (error || !data.session || !data.user) throw Unauthorized('Invalid credentials');

    const profile = await authRepository.getUserProfile(data.user.id);
    if (profile && profile.is_active === false) throw Unauthorized('Account disabled');

    await audit({
      actorUserId: data.user.id,
      action: 'LOGIN',
      entity: 'users',
      entityId: data.user.id,
    });

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
      user: {
        id: data.user.id,
        email: data.user.email,
        fullName: profile?.full_name ?? null,
        isPlatformAdmin: profile?.is_platform_admin ?? false,
      },
    };
  },

  async refresh(refreshToken: string) {
    const { data, error } = await authRepository.refreshSession(refreshToken);
    if (error || !data.session) throw BadRequest('Invalid refresh token');
    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
    };
  },

  async logout(accessToken: string) {
    await authRepository.signOut(accessToken);
    return { success: true };
  },

  async switchTenant(userId: string, tenantId: string) {
    const { data: membership } = await supabaseAdmin
      .from('memberships')
      .select('id')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .maybeSingle();

    if (!membership) throw Forbidden('Not a member of this tenant');

    const { error } = await supabaseAdmin
      .from('users')
      .update({ active_tenant_id: tenantId })
      .eq('id', userId);
    if (error) throw BadRequest(error.message);

    await audit({
      actorUserId: userId,
      tenantId,
      action: 'TENANT_SWITCHED',
      entity: 'users',
      entityId: userId,
      after: { activeTenantId: tenantId },
    });

    return { success: true, tenantId };
  },
};