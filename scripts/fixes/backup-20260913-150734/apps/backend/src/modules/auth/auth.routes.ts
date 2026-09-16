import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate, requireAuth } from '../../middleware/auth.js';
import { loginSchema, refreshSchema } from './auth.validators.js';
import { authService } from './auth.service.js';
import { Unauthorized } from '../../utils/errors.js';

export const authRouter = Router();

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    res.json(await authService.login(email, password));
  }),
);

authRouter.post(
  '/refresh',
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

authRouter.get('/me', authenticate, requireAuth, (req, res) => {
  res.json({ auth: req.auth });
});
