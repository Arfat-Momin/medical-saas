import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requirePermission, requireAnyPermission } from '../../middleware/permissions.js';
import { getAccessToken } from '../../middleware/auth.js';
import { PERMISSIONS } from '@medical/shared';
import {
  createBranchSchema,
  updateBranchSchema,
  listBranchesQuerySchema,
} from './branches.validators.js';
import { branchesService } from './branches.service.js';

export const branchesRouter = Router();

/**
 * SECURITY: the branch list is needed by:
 *   - Branch admin       -> BRANCH_MANAGE
 *   - Department admin   -> DEPARTMENT_MANAGE (branch filter)
 *   - User admin         -> USER_MANAGE       (branch dropdown)
 *   - IPD users          -> IPD_READ          (ward/bed/location dropdowns)
 *
 * Roles that do not need it (PHARMACIST, ACCOUNTANT, LAB_TECHNICIAN
 * without IPD) are excluded.
 */
const READ_PERMS = [
  PERMISSIONS.BRANCH_MANAGE,
  PERMISSIONS.DEPARTMENT_MANAGE,
  PERMISSIONS.USER_MANAGE,
  PERMISSIONS.IPD_READ,
] as const;

branchesRouter.get(
  '/',
  requireAnyPermission(...READ_PERMS),
  asyncHandler(async (req, res) => {
    const { activeOnly } = listBranchesQuerySchema.parse(req.query);
    res.json(await branchesService.list(req.auth!, getAccessToken(req), activeOnly));
  }),
);

branchesRouter.get(
  '/:id',
  requireAnyPermission(...READ_PERMS),
  asyncHandler(async (req, res) => {
    res.json(await branchesService.getById(req.auth!, getAccessToken(req), req.params.id!));
  }),
);

branchesRouter.post(
  '/',
  requirePermission(PERMISSIONS.BRANCH_MANAGE),
  asyncHandler(async (req, res) => {
    const input = createBranchSchema.parse(req.body);
    res.status(201).json(await branchesService.create(req.auth!, getAccessToken(req), input));
  }),
);

branchesRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.BRANCH_MANAGE),
  asyncHandler(async (req, res) => {
    const patch = updateBranchSchema.parse(req.body);
    res.json(
      await branchesService.update(req.auth!, getAccessToken(req), req.params.id!, patch),
    );
  }),
);