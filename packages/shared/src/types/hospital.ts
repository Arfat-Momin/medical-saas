import type { UUID, ISODateString } from './index';

export interface Organization {
    id: UUID;
    tenantId: UUID;
    name: string;
    legalName: string | null;
    type: 'CLINIC' | 'HOSPITAL';
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    createdAt: ISODateString;
    updatedAt: ISODateString;
}

export interface Branch {
    id: UUID;
    tenantId: UUID;
    organizationId: UUID;
    branchCode: string;
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    phone: string | null;
    isActive: boolean;
    createdAt: ISODateString;
    updatedAt: ISODateString;
}

export interface Department {
    id: UUID;
    tenantId: UUID;
    branchId: UUID;
    name: string;
    isActive: boolean;
    createdAt: ISODateString;
}

export interface UserProfile {
    id: UUID;
    email: string;
    fullName: string;
    phone: string | null;
    isPlatformAdmin: boolean;
    isActive: boolean;
    createdAt: ISODateString;
    updatedAt: ISODateString;
}

export interface Role {
    id: UUID;
    tenantId: UUID;
    code: string;
    name: string;
    permissions: string[];
    isSystem: boolean;
    createdAt: ISODateString;
}

export interface MembershipDetail {
    id: UUID;
    tenantId: UUID;
    userId: UUID;
    roleId: UUID;
    branchId: UUID | null;
    isActive: boolean;
    roleCode: string;
    roleName: string;
    branchName: string | null;
}