import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getAccessToken } from '../../middleware/auth.js';
import { registerDeviceSchema, pullQuerySchema } from './sync.validators.js';
import { syncService } from './sync.service.js';

export const syncRouter = Router();

syncRouter.post(
  '/devices',
  asyncHandler(async (req, res) => {
    const input = registerDeviceSchema.parse(req.body);
    res.json(await syncService.registerDevice(req.auth!, getAccessToken(req), input));
  }),
);

syncRouter.get(
  '/pull',
  asyncHandler(async (req, res) => {
    const { entity, since } = pullQuerySchema.parse(req.query);
    res.json(await syncService.pull(req.auth!, getAccessToken(req), { entity, since: since ?? null }));
  }),
);