import { z } from 'zod';
import { PERMISSIONS } from '@medical/shared';

const permissionValues = Object.values(PERMISSIONS) as [string, ...string[]];

export const updateRolePermissionsSchema = z.object({
  /**
   * SECURITY: only accept permission codes that exist in the shared
   * PERMISSIONS constant. Previously this accepted any string, so a
   * client could write garbage into roles.permissions (and any future
   * permission check that reads that column could be bypassed by a
   * one-character typo).
   */
  permissions: z
    .array(z.enum(permissionValues))
    .max(permissionValues.length)
    .transform((arr) => Array.from(new Set(arr))),
});

export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;