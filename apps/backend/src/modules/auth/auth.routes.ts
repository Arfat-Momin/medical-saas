import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate, requireAuth } from '../../middleware/auth.js';
import { loginSchema, refreshSchema, googleSessionSchema } from './auth.validators.js';
import { authService } from './auth.service.js';
import { authRepository } from './auth.repository.js';
import { Unauthorized } from '../../utils/errors.js';
import { authLoginLimiter, authRefreshLimiter } from '../../middleware/rateLimit.js';

export const authRouter = Router();

authRouter.post(
  '/login',
  authLoginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    res.json(await authService.login(email, password));
  }),
);

authRouter.post(
  '/google-session',
  authRefreshLimiter,
  asyncHandler(async (req, res) => {
    const input = googleSessionSchema.parse(req.body);
    res.json(await authService.googleSession(input));
  }),
);

authRouter.post(
  '/refresh',
  authRefreshLimiter,
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    res.json(await authService.refresh(refreshToken));
  }),
);

authRouter.post(
  '/logout',
  authenticate,
  requireAuth,
  asyncHandler(async (req, res) => {
    const token = req.headers.authorization?.slice(7);
    if (!token) throw Unauthorized();
    res.json(await authService.logout(token));
  }),
);

authRouter.post(
  '/logout-all',
  authenticate,
  requireAuth,
  asyncHandler(async (req, res) => {
    const token = req.headers.authorization?.slice(7);
    if (!token) throw Unauthorized();
    res.json(await authService.logoutAll(req.auth!.userId, token));
  }),
);

authRouter.get(
  '/sessions',
  authenticate,
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await authService.listSessions(req.auth!.userId));
  }),
);

authRouter.delete(
  '/sessions/:deviceId',
  authenticate,
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await authService.revokeSession(req.auth!.userId, req.params.deviceId!));
  }),
);

authRouter.get(
  '/me',
  authenticate,
  requireAuth,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    let primaryBranchId: string | null = null;
    if (auth.tenantId) {
      primaryBranchId = await authRepository.getPrimaryBranchForUser(auth.userId, auth.tenantId);
    }
    res.json({ auth, primaryBranchId });
  }),
);