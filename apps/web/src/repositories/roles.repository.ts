import { api } from '@/lib/api';

export interface Role {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  permissions: string[];
  is_system: boolean;
  created_at: string;
}

export const rolesRepository = {
  list: () => api.get<Role[]>('/roles'),
  getById: (id: string) => api.get<Role>(`/roles/${id}`),
  updatePermissions: (id: string, permissions: string[]) =>
    api.patch<Role>(`/roles/${id}/permissions`, { permissions }),
};