export type UUID = string;
export type ISODateString = string;

export type TenantStatus = 'TRIAL' | 'ACTIVE' | 'GRACE' | 'SUSPENDED' | 'CANCELLED';
export type SubscriptionStatus = 'PENDING' | 'ACTIVE' | 'GRACE' | 'SUSPENDED' | 'CANCELLED';
export type TenantType = 'CLINIC' | 'HOSPITAL';

export interface Tenant {
  id: UUID;
  tenantCode: string;
  name: string;
  slug: string;
  type: TenantType;
  status: TenantStatus;
  createdAt: ISODateString;
}

export interface Plan {
  id: UUID;
  code: string;
  name: string;
  priceInPaise: number;
  billingCycle: 'MONTHLY' | 'YEARLY';
  maxBranches: number;
  maxUsers: number;
  features: Record<string, unknown>;
  isActive: boolean;
}

export interface Subscription {
  id: UUID;
  tenantId: UUID;
  planId: UUID;
  status: SubscriptionStatus;
  startsAt: ISODateString;
  endsAt: ISODateString;
  razorpaySubscriptionId: string | null;
}

export interface Membership {
  id: UUID;
  tenantId: UUID;
  userId: UUID;
  roleCode: string;
  branchId: UUID | null;
  isActive: boolean;
}

export interface AuthContext {
  userId: UUID;
  email: string;
  tenantId: UUID | null;
  isPlatformAdmin: boolean;
  roles: string[];
  permissions: string[];
}

export interface SyncMetadata {
  idempotencyKey: string;
  deviceId: string;
  clientTimestamp: ISODateString;
}