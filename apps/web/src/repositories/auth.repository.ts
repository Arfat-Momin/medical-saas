import { api } from '@/lib/api';
import type { AuthUser } from '@/stores/auth.store';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: AuthUser;
}

export interface MeResponse {
  auth: {
    userId: string;
    email: string;
    tenantId: string | null;
    isPlatformAdmin: boolean;
    roles: string[];
    permissions: string[];
  };
  primaryBranchId: string | null;
}

export interface SessionRow {
  id: string;
  device_id: string;
  platform: string;
  app_version: string | null;
  os_version: string | null;
  last_seen_at: string;
  created_at: string;
}

export const authRepository = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }),

  me: () => api.get<MeResponse>('/auth/me'),

  logout: () => api.post<{ success: boolean }>('/auth/logout'),

  logoutAll: () => api.post<{ success: boolean }>('/auth/logout-all'),

  sessions: () => api.get<SessionRow[]>('/auth/sessions'),

  revokeSession: (deviceId: string) =>
    api.delete<{ success: boolean }>(`/auth/sessions/${deviceId}`),
};