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
 * Branch list is used for filter dropdowns on every module page
 * (appointments, IPD beds, pharmacy stock, lab orders, invoices).
 * Every hospital role that reaches one of those pages needs it.
 */
const BRANCH_READ_PERMS = [
  PERMISSIONS.BRANCH_MANAGE,
  PERMISSIONS.DEPARTMENT_MANAGE,
  PERMISSIONS.USER_MANAGE,
  PERMISSIONS.APPOINTMENT_READ,
  PERMISSIONS.CONSULTATION_READ,
  PERMISSIONS.IPD_READ,
  PERMISSIONS.LAB_READ,
  PERMISSIONS.PHARMACY_READ,
  PERMISSIONS.BILLING_READ,
] as const;

branchesRouter.get(
  '/',
  requireAnyPermission(...BRANCH_READ_PERMS),
  asyncHandler(async (req, res) => {
    const { activeOnly } = listBranchesQuerySchema.parse(req.query);
    res.json(await branchesService.list(req.auth!, getAccessToken(req), activeOnly));
  }),
);

branchesRouter.get(
  '/:id',
  requireAnyPermission(...BRANCH_READ_PERMS),
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