import { z } from 'zod';
import { PERMISSIONS, PLATFORM_ONLY_PERMISSIONS } from '@medical/shared';

const permissionValues = Object.values(PERMISSIONS) as [string, ...string[]];

export const updateRolePermissionsSchema = z.object({
  /**
   * SECURITY:
   *  1. Only accept codes that exist in the shared PERMISSIONS map.
   *     Prevents garbage from being written into roles.permissions.
   *  2. Reject any platform:* permission — a tenant role must never
   *     carry a platform-scoped capability, even if a buggy client
   *     tries to send one.
   *  3. De-duplicate so the DB row stays canonical.
   */
  permissions: z
    .array(
      z.enum(permissionValues).refine(
        (code) => !PLATFORM_ONLY_PERMISSIONS.has(code),
        { message: 'Platform permissions cannot be assigned to tenant roles' },
      ),
    )
    .max(permissionValues.length)
    .transform((arr) => Array.from(new Set(arr))),
});

export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;