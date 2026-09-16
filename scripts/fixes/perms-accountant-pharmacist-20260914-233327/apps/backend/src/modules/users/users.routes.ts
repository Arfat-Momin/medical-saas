import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requirePermission, requireAnyPermission } from '../../middleware/permissions.js';
import { getAccessToken } from '../../middleware/auth.js';
import { PERMISSIONS } from '@medical/shared';
import { inviteUserSchema, updateUserSchema, listUsersQuerySchema } from './users.validators.js';
import { usersService } from './users.service.js';

export const usersRouter = Router();

/**
 * SECURITY: the staff directory is not public to every role.
 *
 * Read access is granted to roles that legitimately need the list for
 * a doctor picker or for user management:
 *   - HOSPITAL_ADMIN  -> USER_MANAGE
 *   - RECEPTIONIST    -> APPOINTMENT_READ
 *   - DOCTOR / NURSE  -> IPD_READ
 *   - LAB_TECHNICIAN  -> LAB_ORDER
 *
 * Pharmacists and accountants do not need the full directory and are
 * excluded.
 */
usersRouter.get(
  '/',
  requireAnyPermission(
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.APPOINTMENT_READ,
    PERMISSIONS.IPD_READ,
    PERMISSIONS.LAB_ORDER,
  ),
  asyncHandler(async (req, res) => {
    const query = listUsersQuerySchema.parse(req.query);
    res.json(await usersService.list(req.auth!, getAccessToken(req), query));
  }),
);

usersRouter.get(
  '/:id',
  requireAnyPermission(
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.APPOINTMENT_READ,
    PERMISSIONS.IPD_READ,
    PERMISSIONS.LAB_ORDER,
  ),
  asyncHandler(async (req, res) => {
    res.json(await usersService.getById(req.auth!, getAccessToken(req), req.params.id!));
  }),
);

usersRouter.post(
  '/',
  requirePermission(PERMISSIONS.USER_MANAGE),
  asyncHandler(async (req, res) => {
    const input = inviteUserSchema.parse(req.body);
    res.status(201).json(await usersService.invite(req.auth!, getAccessToken(req), input));
  }),
);

usersRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.USER_MANAGE),
  asyncHandler(async (req, res) => {
    const patch = updateUserSchema.parse(req.body);
    res.json(
      await usersService.update(req.auth!, getAccessToken(req), req.params.id!, patch),
    );
  }),
);