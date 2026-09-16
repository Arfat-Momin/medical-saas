import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requirePermission } from '../../middleware/permissions.js';
import { getAccessToken } from '../../middleware/auth.js';
import { PERMISSIONS } from '@medical/shared';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  listDepartmentsQuerySchema,
} from './departments.validators.js';
import { departmentsService } from './departments.service.js';

export const departmentsRouter = Router();

departmentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { branchId, activeOnly } = listDepartmentsQuerySchema.parse(req.query);
    res.json(await departmentsService.list(req.auth!, getAccessToken(req), branchId, activeOnly));
  }),
);

departmentsRouter.post(
  '/',
  requirePermission(PERMISSIONS.DEPARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const input = createDepartmentSchema.parse(req.body);
    res.status(201).json(await departmentsService.create(req.auth!, getAccessToken(req), input));
  }),
);

departmentsRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.DEPARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const patch = updateDepartmentSchema.parse(req.body);
    res.json(
      await departmentsService.update(req.auth!, getAccessToken(req), req.params.id!, patch),
    );
  }),
);
