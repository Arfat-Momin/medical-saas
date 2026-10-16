import { z } from 'zod';

// ---------- Locations ----------
export const createLocationSchema = z.object({
  branchId: z.string().uuid(),
  parentId: z.string().uuid().nullable().optional(),
  type:     z.enum(['FACILITY','BUILDING','FLOOR','WARD','ROOM','BED']),
  name:         z.string().min(1).max(200),
  code:         z.string().max(50).nullable().optional(),
  capacity:     z.coerce.number().int().min(1).nullable().optional(),
  wardCategory: z.enum(['GENERAL','MALE','FEMALE','ICU','CABIN','PRIVATE','CUSTOM']).nullable().optional(),
  dailyRate:    z.coerce.number().min(0).nullable().optional(),
  pricingNotes: z.string().max(500).nullable().optional(),
});

export const updateLocationSchema = z.object({
  name:          z.string().min(1).max(200).optional(),
  code:          z.string().max(50).nullable().optional(),
  capacity:      z.coerce.number().int().min(1).nullable().optional(),
  isActive:      z.boolean().optional(),
  wardCategory:  z.enum(['GENERAL','MALE','FEMALE','ICU','CABIN','PRIVATE','CUSTOM']).nullable().optional(),
  dailyRate:     z.coerce.number().min(0).nullable().optional(),
  pricingNotes:  z.string().max(500).nullable().optional(),
});

export const listLocationsQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  type:     z.enum(['FACILITY','BUILDING','FLOOR','WARD','ROOM','BED']).optional(),
});

// ---------- Admissions ----------
export const admitPatientSchema = z.object({
  patientId:         z.string().uuid(),
  bedId:             z.string().uuid(),
  admittingDoctor:   z.string().uuid(),
  branchId:          z.string().uuid().optional(),
  reason:            z.string().max(1000).nullable().optional(),
  diagnosis:         z.string().max(1000).nullable().optional(),
  expectedDischarge: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const transferBedSchema = z.object({
  toBedId: z.string().uuid(),
  reason:  z.string().min(1).max(500),
});

export const dischargeSchema = z.object({
  dischargeType:    z.enum(['NORMAL','AGAINST_ADVICE','TRANSFER','DEATH','ABSCONDED']),
  dischargeSummary: z.string().max(3000).nullable().optional(),
});

export const listAdmissionsQuerySchema = z.object({
  status:    z.enum(['ADMITTED','TRANSFERRED','DISCHARGED','CANCELLED']).optional(),
  patientId: z.string().uuid().optional(),
  page:      z.coerce.number().int().min(1).default(1),
  pageSize:  z.coerce.number().int().min(1).max(100).default(20),
});

// ---------- Nursing notes ----------
export const createNursingNoteSchema = z.object({
  noteType: z.enum(['GENERAL','VITALS','MEDICATION','OBSERVATION','INCIDENT','HANDOVER']).default('GENERAL'),
  note:     z.string().min(1).max(3000),
});

// ---------- Doctor rounds ----------
export const createDoctorRoundSchema = z.object({
  clinicalNotes: z.string().max(3000).nullable().optional(),
  assessment:    z.string().max(2000).nullable().optional(),
  plan:          z.string().max(2000).nullable().optional(),
});

// ---------- MAR ----------
export const createMarSchema = z.object({
  medicationName: z.string().min(1).max(200),
  dose:           z.string().max(50).nullable().optional(),
  route:          z.string().max(50).nullable().optional(),
  scheduledAt:    z.string(),   // ISO datetime
  notes:          z.string().max(500).nullable().optional(),
});

export const markMarSchema = z.object({
  status: z.enum(['ADMINISTERED','HELD','REFUSED','MISSED']),
  notes:  z.string().max(500).nullable().optional(),
});

export const signConsentSchema = z.object({
  signature: z.string().min(1, 'Signature is required'),
});

// ---------- IPD Pricing ----------
const PRICING_CATEGORIES = ['WARD','ICU','CABIN','NURSING','SERVICE','PACKAGE','TAX'] as const;

export const createIpdPricingSchema = z.object({
  branchId:   z.string().uuid().optional(),
  category:   z.enum(PRICING_CATEGORIES),
  name:       z.string().min(1).max(200),
  code:       z.string().max(50).nullable().optional(),
  unitPrice:  z.coerce.number().min(0),
  unit:       z.string().max(50).optional().default('per day'),
});

export const updateIpdPricingSchema = z.object({
  name:       z.string().min(1).max(200).optional(),
  code:       z.string().max(50).nullable().optional(),
  category:   z.enum(PRICING_CATEGORIES).optional(),
  unitPrice:  z.coerce.number().min(0).optional(),
  unit:       z.string().max(50).optional(),
  isActive:   z.boolean().optional(),
});

export const listIpdPricingQuerySchema = z.object({
  branchId:  z.string().uuid().optional(),
  category:  z.enum(PRICING_CATEGORIES).optional(),
  isActive:  z.coerce.boolean().optional(),
});

export type CreateLocationInput      = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput      = z.infer<typeof updateLocationSchema>;
export type ListLocationsQuery       = z.infer<typeof listLocationsQuerySchema>;
export type AdmitPatientInput        = z.infer<typeof admitPatientSchema>;
export type TransferBedInput         = z.infer<typeof transferBedSchema>;
export type DischargeInput           = z.infer<typeof dischargeSchema>;
export type ListAdmissionsQuery      = z.infer<typeof listAdmissionsQuerySchema>;
export type CreateNursingNoteInput   = z.infer<typeof createNursingNoteSchema>;
export type CreateDoctorRoundInput   = z.infer<typeof createDoctorRoundSchema>;
export type CreateMarInput           = z.infer<typeof createMarSchema>;
export type MarkMarInput             = z.infer<typeof markMarSchema>;
export type SignConsentInput         = z.infer<typeof signConsentSchema>;
export type CreateIpdPricingInput    = z.infer<typeof createIpdPricingSchema>;
export type UpdateIpdPricingInput    = z.infer<typeof updateIpdPricingSchema>;
export type ListIpdPricingQuery      = z.infer<typeof listIpdPricingQuerySchema>;