import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { chatMessageSchema } from './ai.validators.js';
import { aiService } from './ai.service.js';

export const aiRouter = Router();

aiRouter.post('/chat',
  authenticate,
  asyncHandler(async (req, res) => {
    const input = chatMessageSchema.parse(req.body);
    const userRoles = req.auth?.roles ?? [];
    const response = await aiService.ask(input, userRoles);
    res.json(response);
  }),
);
