import { api } from '@/lib/api';

export interface UserRow {
  id: string;
  tenant_id: string;
  user_id: string;
  role_id: string;
  branch_id: string | null;
  is_active: boolean;
  users: { id: string; email: string; full_name: string; phone: string | null; is_active: boolean };
  roles: { id: string; code: string; name: string };
  branches: { id: string; name: string; branch_code: string } | null;
}

export interface ListUsersResponse {
  rows: UserRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface InviteUserInput {
  email: string;
  fullName: string;
  phone?: string | null;
  roleCode: string;
  branchId?: string | null;
}

export interface InviteUserResponse {
  userId: string;
  email: string;
  fullName: string;
  roleCode: string;
  branchId: string | null;
  tempPassword: string;
}

export const usersRepository = {
  list: (params: { page?: number; pageSize?: number; branchId?: string; roleCode?: string; search?: string }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    return api.get<ListUsersResponse>(`/users?${qs.toString()}`);
  },
  getById: (id: string) => api.get<{ profile: any; memberships: any[] }>(`/users/${id}`),
  invite: (input: InviteUserInput) => api.post<InviteUserResponse>('/users', input),
  update: (id: string, patch: { fullName?: string; phone?: string | null; isActive?: boolean }) =>
    api.patch<any>(`/users/${id}`, patch),
};