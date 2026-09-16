import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requirePermission, requireAnyPermission } from '../../middleware/permissions.js';
import { getAccessToken } from '../../middleware/auth.js';
import { PERMISSIONS } from '@medical/shared';
import { inviteUserSchema, updateUserSchema, listUsersQuerySchema } from './users.validators.js';
import { usersService } from './users.service.js';

export const usersRouter = Router();

/**
 * Staff directory is needed by every hospital role for at least one
 * dropdown / attribution surface:
 *
 *   HOSPITAL_ADMIN  -> USER_MANAGE
 *   DOCTOR          -> APPOINTMENT_READ, IPD_READ, LAB_ORDER, CONSULTATION_READ
 *   NURSE           -> IPD_READ, CONSULTATION_READ
 *   RECEPTIONIST    -> APPOINTMENT_READ
 *   PHARMACIST      -> PHARMACY_READ, BILLING_READ
 *   LAB_TECHNICIAN  -> LAB_ORDER
 *   ACCOUNTANT      -> BILLING_READ, APPOINTMENT_READ, CONSULTATION_READ, IPD_READ, PHARMACY_READ, LAB_READ
 *
 * Any one of these grants read access. The list is explicit so that a
 * future role with none of these is excluded by default.
 */
const DIRECTORY_READ_PERMS = [
  PERMISSIONS.USER_MANAGE,
  PERMISSIONS.APPOINTMENT_READ,
  PERMISSIONS.CONSULTATION_READ,
  PERMISSIONS.IPD_READ,
  PERMISSIONS.LAB_ORDER,
  PERMISSIONS.PHARMACY_READ,
  PERMISSIONS.BILLING_READ,
] as const;

usersRouter.get(
  '/',
  requireAnyPermission(...DIRECTORY_READ_PERMS),
  asyncHandler(async (req, res) => {
    const query = listUsersQuerySchema.parse(req.query);
    res.json(await usersService.list(req.auth!, getAccessToken(req), query));
  }),
);

usersRouter.get(
  '/:id',
  requireAnyPermission(...DIRECTORY_READ_PERMS),
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