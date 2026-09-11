import { api } from '@/lib/api';

export type TenantStatus = 'TRIAL' | 'ACTIVE' | 'GRACE' | 'SUSPENDED' | 'CANCELLED';

export interface Plan {
  id: string;
  code: string;
  name: string;
  price_paise: number;
  billing_cycle: 'MONTHLY' | 'YEARLY';
  max_branches: number;
  max_users: number;
  features: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LatestSubscription {
  id: string;
  tenant_id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  plans: Pick<Plan, 'id' | 'code' | 'name' | 'price_paise' | 'billing_cycle'>;
}

export interface Tenant {
  id: string;
  tenant_code: string;
  name: string;
  slug: string;
  type: 'CLINIC' | 'HOSPITAL';
  status: TenantStatus;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
  updated_at: string;
  latest_subscription?: LatestSubscription | null;
}

export interface SubscriptionPayment {
  id: string;
  amount_paise: number;
  currency: string;
  status: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  created_at: string;
}

export interface TenantFull extends Tenant {
  subscriptions: Array<LatestSubscription & { razorpay_subscription_id: string | null; created_at: string }>;
  payments: SubscriptionPayment[];
}

export interface PlatformStats {
  totalTenants: number;
  active: number;
  trial: number;
  suspended: number;
  expiringSoon: number;
  totalRevenuePaise: number;
}

export interface ExpiringRow {
  id: string;
  tenant_id: string;
  status: string;
  ends_at: string;
  tenants: { id: string; tenant_code: string; name: string };
  plans: { code: string; name: string };
}

export const platformRepository = {
  dashboard: () =>
    api.get<{ stats: PlatformStats; expiringSoon: ExpiringRow[] }>('/platform/dashboard'),

  listTenants: (params: { search?: string; status?: string; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    return api.get<{ rows: Tenant[]; total: number; page: number; pageSize: number }>(`/platform/tenants?${qs.toString()}`);
  },
  getTenant: (id: string) => api.get<TenantFull>(`/platform/tenants/${id}`),
  updateTenant: (id: string, patch: { name?: string; contactEmail?: string | null; contactPhone?: string | null; status?: TenantStatus }) =>
    api.patch<Tenant>(`/platform/tenants/${id}`, patch),
  extendSubscription: (id: string, input: { days: number; notes?: string | null }) =>
    api.post<any>(`/platform/tenants/${id}/extend-subscription`, input),

  listPlans: () => api.get<Plan[]>('/platform/plans'),
  createPlan: (input: { code: string; name: string; pricePaise: number; billingCycle: 'MONTHLY' | 'YEARLY'; maxBranches: number; maxUsers: number }) =>
    api.post<Plan>('/platform/plans', input),
  updatePlan: (id: string, patch: Partial<Plan> & { pricePaise?: number; billingCycle?: string; maxBranches?: number; maxUsers?: number; isActive?: boolean }) =>
    api.patch<Plan>(`/platform/plans/${id}`, patch),
};
