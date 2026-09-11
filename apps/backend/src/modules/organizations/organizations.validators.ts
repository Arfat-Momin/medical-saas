import { z } from 'zod';

export const updateOrganizationSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    legalName: z.string().max(200).nullable().optional(),
    email: z.string().email().nullable().optional(),
    phone: z.string().max(20).nullable().optional(),
    address: z.string().max(500).nullable().optional(),
    city: z.string().max(100).nullable().optional(),
    state: z.string().max(100).nullable().optional(),
    pincode: z.string().max(10).nullable().optional(),
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;