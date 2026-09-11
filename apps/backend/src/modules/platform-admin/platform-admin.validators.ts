import { z } from 'zod';

export const listTenantsQuerySchema = z.object({
  search: z.string().max(100).optional(),
  status: z.enum(['TRIAL','ACTIVE','GRACE','SUSPENDED','CANCELLED']).optional(),
  expiringInDays: z.coerce.number().int().min(1).max(365).optional(),
  page:     z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateTenantSchema = z.object({
  name:          z.string().min(1).max(200).optional(),
  contactEmail:  z.string().email().nullable().optional(),
  contactPhone:  z.string().max(20).nullable().optional(),
  status:        z.enum(['TRIAL','ACTIVE','GRACE','SUSPENDED','CANCELLED']).optional(),
});

export const extendSubscriptionSchema = z.object({
  days:  z.coerce.number().int().min(1).max(3650),
  notes: z.string().max(500).nullable().optional(),
});

export const createPlanSchema = z.object({
  code:          z.string().min(1).max(50),
  name:          z.string().min(1).max(200),
  pricePaise:    z.coerce.number().int().min(0),
  billingCycle:  z.enum(['MONTHLY','YEARLY']),
  maxBranches:   z.coerce.number().int().min(1).default(1),
  maxUsers:      z.coerce.number().int().min(1).default(5),
  features:      z.record(z.string(), z.unknown()).optional(),
});

export const updatePlanSchema = createPlanSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type ListTenantsQuery = z.infer<typeof listTenantsQuerySchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type ExtendSubscriptionInput = z.infer<typeof extendSubscriptionSchema>;
export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;