import { z } from 'zod';

const num = z.union([z.number(), z.string(), z.null()]).optional();
const str = (max: number) => z.string().max(max).nullable().optional();

// ---- Test master ----
export const createLabTestSchema = z.object({
  code:          str(50),
  name:          z.string().min(1).max(200),
  category:      str(50),
  sampleType:    str(50),
  unit:          str(20),
  referenceMin:  num,
  referenceMax:  num,
  referenceText: str(200),
  price:         z.coerce.number().nonnegative().default(0),
  turnaroundHrs: z.coerce.number().int().min(1).default(24),
});
export const updateLabTestSchema = createLabTestSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const listLabTestsQuerySchema = z.object({
  search: z.string().max(100).optional(),
  page:   z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(20),
  activeOnly: z.coerce.boolean().default(true),
});

// ---- Orders ----
export const createLabOrderSchema = z.object({
  patientId:   z.string().uuid(),
  doctorId:    z.string().uuid(),
  branchId:    z.string().uuid().optional(),
  encounterId: z.string().uuid().nullable().optional(),
  priority:    z.enum(['ROUTINE','URGENT','STAT']).default('ROUTINE'),
  notes:       z.string().max(1000).nullable().optional(),
  testIds:     z.array(z.string().uuid()).min(1),
});

export const collectSampleSchema = z.object({
  sampleType: z.string().min(1).max(50),
  barcode:    z.string().max(50).nullable().optional(),
  notes:      z.string().max(500).nullable().optional(),
});

export const enterResultsSchema = z.object({
  items: z.array(z.object({
    itemId:       z.string().uuid(),
    resultValue:  z.string().max(200).nullable().optional(),
    resultUnit:   z.string().max(50).nullable().optional(),
    flag:         z.enum(['NORMAL','HIGH','LOW','ABNORMAL','CRITICAL']).nullable().optional(),
    remarks:      z.string().max(500).nullable().optional(),
  })).min(1),
});

export const listLabOrdersQuerySchema = z.object({
  status:    z.enum(['ORDERED','COLLECTED','RESULTED','VERIFIED','CANCELLED']).optional(),
  patientId: z.string().uuid().optional(),
  date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page:      z.coerce.number().int().min(1).default(1),
  pageSize:  z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateLabTestInput = z.infer<typeof createLabTestSchema>;
export type UpdateLabTestInput = z.infer<typeof updateLabTestSchema>;
export type CreateLabOrderInput = z.infer<typeof createLabOrderSchema>;
export type CollectSampleInput = z.infer<typeof collectSampleSchema>;
export type EnterResultsInput = z.infer<typeof enterResultsSchema>;
export type ListLabTestsQuery = z.infer<typeof listLabTestsQuerySchema>;
export type ListLabOrdersQuery = z.infer<typeof listLabOrdersQuerySchema>;