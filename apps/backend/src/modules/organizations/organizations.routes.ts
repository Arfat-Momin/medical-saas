import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requirePermission } from '../../middleware/permissions.js';
import { getAccessToken } from '../../middleware/auth.js';
import { PERMISSIONS } from '@medical/shared';
import { updateOrganizationSchema } from './organizations.validators.js';
import { organizationsService } from './organizations.service.js';

export const organizationsRouter = Router();

organizationsRouter.get(
    '/me',
    asyncHandler(async (req, res) => {
        res.json(await organizationsService.getMine(req.auth!, getAccessToken(req)));
    }),
);

organizationsRouter.patch(
    '/me',
    requirePermission(PERMISSIONS.ORG_MANAGE),
    asyncHandler(async (req, res) => {
        const patch = updateOrganizationSchema.parse(req.body);
        res.json(await organizationsService.updateMine(req.auth!, getAccessToken(req), patch));
    }),
);