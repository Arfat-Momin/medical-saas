import { authRepository } from './auth.repository.js';
import { BadRequest, Unauthorized } from '../../utils/errors.js';
import { audit } from '../../middleware/audit.js';
import { supabaseAdmin } from '../../config/supabase.js';

export const authService = {
  /**
   * Exchange a Supabase session (obtained from Google OAuth on the
   * frontend) for a backend session.
   *
   * Returns { needsSignup: true, email, fullName } when the Google user
   * has no public.users profile yet, or has no active tenant membership.
   * The frontend then redirects to /signup with the Google details
   * pre-filled.
   */
  async googleSession(input: { accessToken: string; refreshToken: string; expiresAt?: number }) {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(input.accessToken);
    if (error || !user) throw Unauthorized('Invalid Google session');

    const profile = await authRepository.getUserProfile(user.id);

    if (!profile) {
      return {
        needsSignup: true,
        email: user.email ?? '',
        fullName:
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          null,
      };
    }

    if (profile.is_active === false) throw Unauthorized('Invalid credentials');

    const membership = await authRepository.findActiveMembership(user.id);
    if (!membership) {
      return {
        needsSignup: true,
        email: profile.email ?? user.email ?? '',
        fullName: profile.full_name ?? null,
      };
    }

    await audit({
      actorUserId: user.id,
      action: 'LOGIN_GOOGLE',
      entity: 'users',
      entityId: user.id,
    });

    return {
      needsSignup: false,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      expiresAt: input.expiresAt ?? Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: user.id,
        email: user.email ?? profile.email ?? '',
        fullName: profile.full_name ?? null,
        isPlatformAdmin: profile.is_platform_admin ?? false,
      },
    };
  },

  async login(email: string, password: string) {
    const { data, error } = await authRepository.signInWithPassword(email, password);
    if (error || !data.session || !data.user) throw Unauthorized('Invalid credentials');

    const profile = await authRepository.getUserProfile(data.user.id);
    // SECURITY: do NOT reveal 'Account disabled' — that leaks which
    // emails exist on the platform. Return the same generic message
    // as a wrong password.
    if (profile && profile.is_active === false) throw Unauthorized('Invalid credentials');

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

  async logoutAll(userId: string, accessToken: string) {
    await authRepository.signOutAll(accessToken);
    await supabaseAdmin.from('devices').delete().eq('user_id', userId);
    await audit({
      actorUserId: userId,
      action: 'LOGOUT_ALL',
      entity: 'users',
      entityId: userId,
    });
    return { success: true };
  },

  async listSessions(userId: string) {
    return authRepository.listDevices(userId);
  },

  async revokeSession(userId: string, deviceId: string) {
    await authRepository.revokeDevice(userId, deviceId);
    await audit({
      actorUserId: userId,
      action: 'SESSION_REVOKED',
      entity: 'devices',
      entityId: deviceId,
    });
    return { success: true };
  },
};