import { z } from 'zod';

export const createDepartmentSchema = z.object({
    branchId: z.string().uuid(),
    name: z.string().min(1).max(200),
});

export const updateDepartmentSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    isActive: z.boolean().optional(),
});

export const listDepartmentsQuerySchema = z.object({
    branchId: z.string().uuid().optional(),
    activeOnly: z.coerce.boolean().default(true),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export type ListDepartmentsQuery = z.infer<typeof listDepartmentsQuerySchema>;