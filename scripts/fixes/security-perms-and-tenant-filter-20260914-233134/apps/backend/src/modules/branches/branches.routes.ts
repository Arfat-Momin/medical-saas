import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requirePermission } from '../../middleware/permissions.js';
import { getAccessToken } from '../../middleware/auth.js';
import { PERMISSIONS } from '@medical/shared';
import {
  createBranchSchema,
  updateBranchSchema,
  listBranchesQuerySchema,
} from './branches.validators.js';
import { branchesService } from './branches.service.js';

export const branchesRouter = Router();

branchesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { activeOnly } = listBranchesQuerySchema.parse(req.query);
    res.json(await branchesService.list(req.auth!, getAccessToken(req), activeOnly));
  }),
);

branchesRouter.get(
  '/:id',
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
