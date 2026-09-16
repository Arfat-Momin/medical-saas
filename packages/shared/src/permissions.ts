export const PERMISSIONS = {
  // Organization / structure
  ORG_MANAGE: 'org:manage',
  BRANCH_MANAGE: 'branch:manage',
  DEPARTMENT_MANAGE: 'department:manage',
  USER_MANAGE: 'user:manage',
  ROLE_MANAGE: 'role:manage',

  // Patients
  PATIENT_READ: 'patient:read',
  PATIENT_CREATE: 'patient:create',
  PATIENT_UPDATE: 'patient:update',

  // Appointments + OPD
  APPOINTMENT_READ: 'appointment:read',
  APPOINTMENT_MANAGE: 'appointment:manage',
  CONSULTATION_READ: 'consultation:read',
  CONSULTATION_WRITE: 'consultation:write',

  // IPD
  IPD_READ: 'ipd:read',
  IPD_MANAGE: 'ipd:manage',
  MAR_WRITE: 'mar:write',

  // Pharmacy
  PHARMACY_READ: 'pharmacy:read',
  PHARMACY_DISPENSE: 'pharmacy:dispense',
  PHARMACY_STOCK: 'pharmacy:stock',

  // Laboratory
  LAB_READ: 'lab:read',
  LAB_ORDER: 'lab:order',
  LAB_RESULT_ENTER: 'lab:result:enter',
  LAB_RESULT_VERIFY: 'lab:result:verify',

  // Hospital billing (internal only — NO Razorpay)
  BILLING_READ: 'billing:read',
  BILLING_MANAGE: 'billing:manage',
  BILLING_REFUND: 'billing:refund',

  // Platform (Super Admin only — never assignable to a tenant role)
  PLATFORM_TENANT_MANAGE: 'platform:tenant:manage',
  PLATFORM_PLAN_MANAGE: 'platform:plan:manage',
  PLATFORM_SUBSCRIPTION_MANAGE: 'platform:subscription:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Permissions that must NEVER appear on a tenant-scoped role.
 * Used by the roles validator to reject escalation attempts.
 */
export const PLATFORM_ONLY_PERMISSIONS: ReadonlySet<string> = new Set([
  PERMISSIONS.PLATFORM_TENANT_MANAGE,
  PERMISSIONS.PLATFORM_PLAN_MANAGE,
  PERMISSIONS.PLATFORM_SUBSCRIPTION_MANAGE,
]);

import type { RoleCode } from './roles';

/**
 * SEED_ROLE_PERMISSIONS — SEED DATA ONLY.
 *
 * This map exists for ONE purpose: to populate `public.roles.permissions`
 * when a new tenant is provisioned, and to backfill existing tenants
 * whose roles still have NULL. It is consumed by the provisioning SQL
 * migration, NOT by any runtime code path.
 *
 * The source of truth at runtime is the DATABASE. The hospital admin
 * assigns and edits permissions through the Roles page; `authenticate`
 * reads whatever is stored in `roles.permissions`.
 *
 * If you ever want to change the recommended default for a role, change
 * the SQL migration — not this file at runtime.
 */
export const SEED_ROLE_PERMISSIONS: Record<RoleCode, Permission[]> = {
  SUPER_ADMIN: [
    PERMISSIONS.PLATFORM_TENANT_MANAGE,
    PERMISSIONS.PLATFORM_PLAN_MANAGE,
    PERMISSIONS.PLATFORM_SUBSCRIPTION_MANAGE,
    // Deliberately no hospital-scoped permission.
  ],
  HOSPITAL_ADMIN: [
    PERMISSIONS.ORG_MANAGE, PERMISSIONS.BRANCH_MANAGE, PERMISSIONS.DEPARTMENT_MANAGE,
    PERMISSIONS.USER_MANAGE, PERMISSIONS.ROLE_MANAGE,
    PERMISSIONS.PATIENT_READ, PERMISSIONS.PATIENT_CREATE, PERMISSIONS.PATIENT_UPDATE,
    PERMISSIONS.APPOINTMENT_READ, PERMISSIONS.APPOINTMENT_MANAGE,
    PERMISSIONS.CONSULTATION_READ, PERMISSIONS.CONSULTATION_WRITE,
    PERMISSIONS.IPD_READ, PERMISSIONS.IPD_MANAGE, PERMISSIONS.MAR_WRITE,
    PERMISSIONS.PHARMACY_READ, PERMISSIONS.PHARMACY_DISPENSE, PERMISSIONS.PHARMACY_STOCK,
    PERMISSIONS.LAB_READ, PERMISSIONS.LAB_ORDER, PERMISSIONS.LAB_RESULT_ENTER, PERMISSIONS.LAB_RESULT_VERIFY,
    PERMISSIONS.BILLING_READ, PERMISSIONS.BILLING_MANAGE, PERMISSIONS.BILLING_REFUND,
  ],
  DOCTOR: [
    PERMISSIONS.PATIENT_READ, PERMISSIONS.PATIENT_UPDATE,
    PERMISSIONS.APPOINTMENT_READ, PERMISSIONS.APPOINTMENT_MANAGE,
    PERMISSIONS.CONSULTATION_READ, PERMISSIONS.CONSULTATION_WRITE,
    PERMISSIONS.IPD_READ, PERMISSIONS.IPD_MANAGE, PERMISSIONS.MAR_WRITE,
    PERMISSIONS.LAB_READ, PERMISSIONS.LAB_ORDER,
    PERMISSIONS.PHARMACY_READ,
  ],
  NURSE: [
    PERMISSIONS.PATIENT_READ,
    PERMISSIONS.APPOINTMENT_READ,
    PERMISSIONS.CONSULTATION_READ,
    PERMISSIONS.IPD_READ, PERMISSIONS.IPD_MANAGE, PERMISSIONS.MAR_WRITE,
    PERMISSIONS.LAB_READ,
  ],
  RECEPTIONIST: [
    PERMISSIONS.PATIENT_READ, PERMISSIONS.PATIENT_CREATE, PERMISSIONS.PATIENT_UPDATE,
    PERMISSIONS.APPOINTMENT_READ, PERMISSIONS.APPOINTMENT_MANAGE,
    PERMISSIONS.BILLING_READ,
  ],
  PHARMACIST: [
    PERMISSIONS.PATIENT_READ,
    PERMISSIONS.PHARMACY_READ, PERMISSIONS.PHARMACY_DISPENSE, PERMISSIONS.PHARMACY_STOCK,
    PERMISSIONS.BILLING_READ,
  ],
  LAB_TECHNICIAN: [
    PERMISSIONS.PATIENT_READ,
    PERMISSIONS.LAB_READ, PERMISSIONS.LAB_ORDER,
    PERMISSIONS.LAB_RESULT_ENTER, PERMISSIONS.LAB_RESULT_VERIFY,
  ],
  ACCOUNTANT: [
    PERMISSIONS.PATIENT_READ,
    PERMISSIONS.APPOINTMENT_READ,
    PERMISSIONS.CONSULTATION_READ,
    PERMISSIONS.IPD_READ,
    PERMISSIONS.PHARMACY_READ,
    PERMISSIONS.LAB_READ,
    PERMISSIONS.BILLING_READ, PERMISSIONS.BILLING_MANAGE, PERMISSIONS.BILLING_REFUND,
  ],
};

/**
 * @deprecated Use SEED_ROLE_PERMISSIONS. Alias kept so existing
 * imports don't break during the migration to DB-only permissions.
 */
export const DEFAULT_ROLE_PERMISSIONS = SEED_ROLE_PERMISSIONS;