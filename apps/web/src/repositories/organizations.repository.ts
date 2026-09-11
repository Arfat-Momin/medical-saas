import { api } from '@/lib/api';

export interface Organization {
  id: string;
  tenant_id: string;
  name: string;
  legal_name: string | null;
  type: 'CLINIC' | 'HOSPITAL';
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  legalName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}

export const organizationsRepository = {
  getMine: () => api.get<Organization>('/organizations/me'),
  updateMine: (patch: UpdateOrganizationInput) =>
    api.patch<Organization>('/organizations/me', patch),
};