import { api } from '@/lib/api';

export interface SignupInput {
  email: string;
  password?: string;
  contactName: string;
  contactPhone?: string | null;
  hospitalName: string;
  tenantType: 'CLINIC' | 'HOSPITAL';
  planCode: string;
  googleAccessToken?: string;
}

export interface VerifySignatureInput {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface VerifyRenewalInput {
  renewalId: string;
  paymentId: string;
  signature: string;
}

export interface CurrentSubscriptionResponse {
  subscription: {
    id: string;
    status: string;
    startsAt: string;
    endsAt: string;
    isFreeTier: boolean;
    renewalOf: string | null;
  };
  plan: {
    id: string;
    code: string;
    name: string;
    price_paise: number;
    billing_cycle: 'MONTHLY' | 'YEARLY';
    max_branches: number;
    max_users: number;
    is_free: boolean;
    trial_days: number | null;
    is_renewable: boolean;
  };
  daysRemaining: number;
  isExpired: boolean;
  payments: Array<{
    id: string;
    amount_paise: number;
    currency: string;
    status: string;
    razorpay_payment_id: string | null;
    created_at: string;
  }>;
}

export const subscriptionsRepository = {
  listPlans: () => api.get<any[]>('/subscriptions/plans'),
  signup: (input: SignupInput) => api.post<any>('/subscriptions/signup', input),
  getStatus: (signupId: string) => api.get<any>(`/subscriptions/signup/${signupId}`),
  verifySignature: (input: VerifySignatureInput) =>
    api.post<any>('/subscriptions/verify-signature', input),

  getCurrentSubscription: () =>
    api.get<CurrentSubscriptionResponse>('/subscriptions/current'),

  createRenewal: (planId: string) =>
    api.post<{
      renewalId: string;
      orderId: string;
      amount: number;
      currency: string;
      plan: { code: string; name: string };
      razorpayKeyId: string;
    }>('/subscriptions/renew', { planId }),

  verifyRenewal: (input: VerifyRenewalInput) =>
    api.post<any>('/subscriptions/verify-renewal', input),
};
