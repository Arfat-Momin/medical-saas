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
}

export const authRepository = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }),
  me: () => api.get<MeResponse>('/auth/me'),
  logout: () => api.post<{ success: boolean }>('/auth/logout'),
};