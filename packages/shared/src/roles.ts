/** Platform-level role — has NO access to any hospital data. */
export const PLATFORM_ROLE = 'SUPER_ADMIN' as const;

/** Hospital-level roles — created & managed by the Hospital Admin. */
export const HOSPITAL_ROLES = [
  'HOSPITAL_ADMIN',
  'DOCTOR',
  'NURSE',
  'RECEPTIONIST',
  'PHARMACIST',
  'LAB_TECHNICIAN',
  'ACCOUNTANT',
] as const;

export type HospitalRole = (typeof HOSPITAL_ROLES)[number];
export type RoleCode = typeof PLATFORM_ROLE | HospitalRole;

export const ROLE_LABELS: Record<RoleCode, string> = {
  SUPER_ADMIN: 'Super Admin',
  HOSPITAL_ADMIN: 'Hospital Admin',
  DOCTOR: 'Doctor',
  NURSE: 'Nurse',
  RECEPTIONIST: 'Receptionist',
  PHARMACIST: 'Pharmacist',
  LAB_TECHNICIAN: 'Lab Technician',
  ACCOUNTANT: 'Accountant',
};
