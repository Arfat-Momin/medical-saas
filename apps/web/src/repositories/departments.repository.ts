import { api } from '@/lib/api';

export interface Department {
  id: string;
  tenant_id: string;
  branch_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface CreateDepartmentInput {
  branchId: string;
  name: string;
}

export const departmentsRepository = {
  list: (branchId?: string, activeOnly = true) => {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', branchId);
    params.set('activeOnly', String(activeOnly));
    return api.get<Department[]>(`/departments?${params.toString()}`);
  },
  create: (input: CreateDepartmentInput) => api.post<Department>('/departments', input),
  update: (id: string, patch: { name?: string; isActive?: boolean }) =>
    api.patch<Department>(`/departments/${id}`, patch),
};