import { z } from 'zod';

export const updateRolePermissionsSchema = z.object({
    permissions: z.array(z.string().min(1)).max(200),
});

export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;