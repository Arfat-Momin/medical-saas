import { authRepository } from './auth.repository.js';
import { BadRequest, Unauthorized } from '../../utils/errors.js';
import { audit } from '../../middleware/audit.js';

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
};
