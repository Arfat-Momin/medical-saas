import { z } from 'zod';

const numOrNull = z.union([z.number(), z.string(), z.null()]).optional();

export const saveEncounterSchema = z.object({
  chiefComplaint: z.string().max(1000).nullable().optional(),
  history:        z.string().max(2000).nullable().optional(),
  examination:    z.string().max(2000).nullable().optional(),
  notes:          z.string().max(2000).nullable().optional(),
  vitals: z.object({
    temperatureC: numOrNull,
    bpSystolic:   numOrNull,
    bpDiastolic:  numOrNull,
    pulse:        numOrNull,
    respRate:     numOrNull,
    spo2:         numOrNull,
    weightKg:     numOrNull,
    heightCm:     numOrNull,
    bmi:          numOrNull,
  }).optional(),
  diagnoses: z.array(z.object({
    diagnosisText: z.string().min(1).max(500),
    icdCode:       z.string().max(20).nullable().optional(),
    notes:         z.string().max(500).nullable().optional(),
    isPrimary:     z.boolean().default(false),
  })).optional(),
  prescription: z.object({
    notes: z.string().max(1000).nullable().optional(),
    items: z.array(z.object({
      medicineName: z.string().min(1).max(200),
      dosage:       z.string().max(50).nullable().optional(),
      frequency:    z.string().max(50).nullable().optional(),
      duration:     z.string().max(50).nullable().optional(),
      route:        z.string().max(50).nullable().optional(),
      instructions: z.string().max(500).nullable().optional(),
      quantity:     z.union([z.number(), z.string(), z.null()]).optional(),
    })).default([]),
  }).optional(),
  complete: z.boolean().default(false),
});

export const createWalkInSchema = z.object({
  patientId: z.string().uuid(),
  doctorId:  z.string().uuid(),
  branchId:  z.string().uuid().optional(),
  chiefComplaint: z.string().max(1000).nullable().optional(),
});

export const listEncountersQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  doctorId:  z.string().uuid().optional(),
  date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page:      z.coerce.number().int().min(1).default(1),
  pageSize:  z.coerce.number().int().min(1).max(50).default(20),
});

export type SaveEncounterInput = z.infer<typeof saveEncounterSchema>;
export type CreateWalkInInput = z.infer<typeof createWalkInSchema>;
export type ListEncountersQuery = z.infer<typeof listEncountersQuerySchema>;