import { api } from '@/lib/api';

export interface PublicPlan {
  id: string;
  code: string;
  name: string;
  price_paise: number;
  billing_cycle: 'MONTHLY' | 'YEARLY';
  max_branches: number;
  max_users: number;
  features: Record<string, unknown>;
  is_active: boolean;
}

export interface SignupInput {
  email: string;
  password: string;
  contactName: string;
  contactPhone?: string | null;
  hospitalName: string;
  hospitalSlug?: string;
  tenantType: 'CLINIC' | 'HOSPITAL';
  planCode: string;
}

export interface SignupResponse {
  signupId: string;
  orderId: string;
  amount: number;
  currency: string;
  plan: { code: string; name: string };
  razorpayKeyId: string;
}

export interface SignupStatus {
  id: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'PROVISIONED';
  email: string;
  hospitalName: string;
  tenantId: string | null;
  createdAt: string;
}

export interface VerifyResponse {
  alreadyProvisioned: boolean;
  tenantId: string;
  orgId?: string;
  branchId?: string;
  subscriptionId?: string;
}

export const subscriptionsRepository = {
  listPlans: () => api.get<PublicPlan[]>('/subscriptions/plans'),
  signup: (input: SignupInput) => api.post<SignupResponse>('/subscriptions/signup', input),
  getStatus: (signupId: string) => api.get<SignupStatus>(`/subscriptions/signup/${signupId}`),
  verifySignature: (input: { orderId: string; paymentId: string; signature: string }) =>
    api.post<VerifyResponse>('/subscriptions/verify-signature', input),
};
