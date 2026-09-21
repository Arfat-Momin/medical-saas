import { z } from 'zod';

export const inviteUserSchema = z.object({
    email: z.string().email(),
    fullName: z.string().min(1).max(200),
    phone: z.string().max(20).nullable().optional(),
    roleCode: z.string().min(1),
    branchId: z.string().uuid().nullable().optional(),
    password: z.string().min(8).max(100),
});

export const updateUserSchema = z.object({
    fullName: z.string().min(1).max(200).optional(),
    phone: z.string().max(20).nullable().optional(),
    isActive: z.boolean().optional(),
    consultationFee: z.coerce.number().nonnegative().max(1_000_000).optional(),
});

export const listUsersQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(500).default(10),
    branchId: z.string().uuid().optional(),
    roleCode: z.string().optional(),
    search: z.string().optional(),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;