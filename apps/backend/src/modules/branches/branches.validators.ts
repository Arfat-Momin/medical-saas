import { z } from 'zod';

export const createBranchSchema = z.object({
    name: z.string().min(1).max(200),
    address: z.string().max(500).nullable().optional(),
    city: z.string().max(100).nullable().optional(),
    state: z.string().max(100).nullable().optional(),
    pincode: z.string().max(10).nullable().optional(),
    phone: z.string().max(20).nullable().optional(),
});

export const updateBranchSchema = createBranchSchema.partial().extend({
    isActive: z.boolean().optional(),
});

export const listBranchesQuerySchema = z.object({
    activeOnly: z.coerce.boolean().default(true),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type ListBranchesQuery = z.infer<typeof listBranchesQuerySchema>;