import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requirePermission } from '../../middleware/permissions.js';
import { getAccessToken } from '../../middleware/auth.js';
import { PERMISSIONS } from '@medical/shared';
import { inviteUserSchema, updateUserSchema, listUsersQuerySchema } from './users.validators.js';
import { usersService } from './users.service.js';

export const usersRouter = Router();

usersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listUsersQuerySchema.parse(req.query);
    res.json(await usersService.list(req.auth!, getAccessToken(req), query));
  }),
);

usersRouter.get(
  '/:id',
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
