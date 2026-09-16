import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  isPlatformAdmin: boolean;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  tenantId: string | null;
  primaryBranchId: string | null;
  roles: string[];
  permissions: string[];

  setSession: (s: { accessToken: string; refreshToken: string; user: AuthUser }) => void;
  setContext: (c: {
    tenantId: string | null;
    primaryBranchId?: string | null;
    roles: string[];
    permissions: string[];
  }) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      tenantId: null,
      primaryBranchId: null,
      roles: [],
      permissions: [],

      setSession: ({ accessToken, refreshToken, user }) =>
        set({ accessToken, refreshToken, user }),
  setContext: ({ tenantId, primaryBranchId, roles, permissions }) =>
        set({
          tenantId,
          primaryBranchId: primaryBranchId ?? null,
          roles,
          permissions,
        }),

      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          tenantId: null,
          primaryBranchId: null,
          roles: [],
          permissions: [],
        }),
    }),
    {
      name: 'medical_auth',
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        user: s.user,
        tenantId: s.tenantId,
        primaryBranchId: s.primaryBranchId,
        roles: s.roles,
        permissions: s.permissions,
      }),
    },
  ),
);
