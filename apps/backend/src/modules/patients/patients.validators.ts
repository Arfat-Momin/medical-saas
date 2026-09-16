import { z } from 'zod';

const nullableString = (max: number) =>
  z.string().max(max).nullable().optional().transform((v) => (v === '' ? null : v));

export const createPatientSchema = z.object({
  fullName:        z.string().min(1).max(200),
  dateOfBirth:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  gender:          z.enum(['MALE', 'FEMALE', 'OTHER']).nullable().optional(),
  mobile:          nullableString(20),
  address:         nullableString(500),
  bloodGroup:      z.enum(['A+','A-','B+','B-','AB+','AB-','O+','O-']).nullable().optional(),
  allergies:       nullableString(1000),
  medicalHistory:  nullableString(2000),
  emergencyContact:nullableString(200),
  branchId:        z.string().uuid().optional(), // default = user's primary branch
});

export const updatePatientSchema = createPatientSchema.partial().omit({ branchId: true });

export const listPatientsQuerySchema = z.object({
  page:      z.coerce.number().int().min(1).default(1),
  pageSize:  z.coerce.number().int().min(1).max(500).default(10),
  search:    z.string().max(100).optional(),
  branchId:  z.string().uuid().optional(),
});

export const checkDuplicateSchema = z.object({
  mobile:      z.string().max(20).optional(),
  fullName:    z.string().max(200).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type ListPatientsQuery = z.infer<typeof listPatientsQuerySchema>;
export type CheckDuplicateInput = z.infer<typeof checkDuplicateSchema>;