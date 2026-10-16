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
  billingCycle:  z.enum(['MONTHLY','YEARLY','CUSTOM']),
  customTenureDays: z.coerce.number().int().min(1).optional(),
  maxBranches:   z.coerce.number().int().min(1).default(1),
  maxUsers:      z.coerce.number().int().min(1).default(5),
  features:      z.record(z.string(), z.unknown()).optional(),
});

export const updatePlanSchema = createPlanSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const createCustomTenantSchema = z.object({
  tenantName:       z.string().min(1).max(200),
  tenantSlug:       z.string().min(3).max(50),
  tenantEmail:      z.string().email().nullable().optional(),
  tenantPhone:      z.string().max(20).nullable().optional(),
  adminFullName:    z.string().min(1).max(200),
  adminEmail:       z.string().email(),
  adminPassword:    z.string().min(6),
  planName:         z.string().min(1).max(200),
  planPricePaise:   z.coerce.number().int().min(0),
  billingCycle:     z.enum(['MONTHLY','YEARLY','CUSTOM']),
  customTenureDays: z.coerce.number().int().min(1).optional(),
  maxBranches:      z.coerce.number().int().min(1).default(1),
  maxUsers:         z.coerce.number().int().min(1).default(5),
});

export type ListTenantsQuery = z.infer<typeof listTenantsQuerySchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type ExtendSubscriptionInput = z.infer<typeof extendSubscriptionSchema>;
export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type CreateCustomTenantInput = z.infer<typeof createCustomTenantSchema>;