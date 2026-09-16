import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { signupSchema, verifySignatureSchema } from './subscriptions.validators.js';
import { subscriptionsService } from './subscriptions.service.js';
import { signupLimiter, signupEmailLimiter } from '../../middleware/rateLimit.js';

export const subscriptionsRouter = Router();

subscriptionsRouter.get('/plans',
  asyncHandler(async (_req, res) => {
    res.json(await subscriptionsService.listPublicPlans());
  }),
);

subscriptionsRouter.post('/signup',
  signupLimiter,
  signupEmailLimiter,
  asyncHandler(async (req, res) => {
    const input = signupSchema.parse(req.body);
    res.status(201).json(await subscriptionsService.createSignup(input));
  }),
);

subscriptionsRouter.get('/signup/:id',
  asyncHandler(async (req, res) => {
    res.json(await subscriptionsService.getSignupStatus(req.params.id!));
  }),
);

subscriptionsRouter.post('/verify-signature',
  asyncHandler(async (req, res) => {
    const input = verifySignatureSchema.parse(req.body);
    res.json(await subscriptionsService.verifySignature(input));
  }),
);