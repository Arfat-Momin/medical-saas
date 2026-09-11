import { api } from '@/lib/api';

export interface Branch {
  id: string;
  tenant_id: string;
  organization_id: string;
  branch_code: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateBranchInput {
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  phone?: string | null;
}

export interface UpdateBranchInput extends Partial<CreateBranchInput> {
  isActive?: boolean;
}

export const branchesRepository = {
  list: (activeOnly = true) => api.get<Branch[]>(`/branches?activeOnly=${activeOnly}`),
  getById: (id: string) => api.get<Branch>(`/branches/${id}`),
  create: (input: CreateBranchInput) => api.post<Branch>('/branches', input),
  update: (id: string, patch: UpdateBranchInput) => api.patch<Branch>(`/branches/${id}`, patch),
};