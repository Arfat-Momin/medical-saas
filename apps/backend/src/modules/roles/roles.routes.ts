import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requirePermission } from '../../middleware/permissions.js';
import { getAccessToken } from '../../middleware/auth.js';
import { PERMISSIONS } from '@medical/shared';
import { updateRolePermissionsSchema } from './roles.validators.js';
import { rolesService } from './roles.service.js';

export const rolesRouter = Router();

// SECURITY: role definitions (including their permission arrays) are
// admin-only metadata. Gate every read with ROLE_MANAGE.
rolesRouter.get(
  '/',
  requirePermission(PERMISSIONS.ROLE_MANAGE),
  asyncHandler(async (req, res) => {
    res.json(await rolesService.list(req.auth!, getAccessToken(req)));
  }),
);

rolesRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.ROLE_MANAGE),
  asyncHandler(async (req, res) => {
    res.json(await rolesService.getById(req.auth!, getAccessToken(req), req.params.id!));
  }),
);

rolesRouter.patch(
  '/:id/permissions',
  requirePermission(PERMISSIONS.ROLE_MANAGE),
  asyncHandler(async (req, res) => {
    const { permissions } = updateRolePermissionsSchema.parse(req.body);
    res.json(
      await rolesService.updatePermissions(
        req.auth!,
        getAccessToken(req),
        req.params.id!,
        permissions,
      ),
    );
  }),
);