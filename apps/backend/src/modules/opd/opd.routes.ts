import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requirePermission } from '../../middleware/permissions.js';
import { getAccessToken } from '../../middleware/auth.js';
import { PERMISSIONS } from '@medical/shared';
import { saveEncounterSchema, createWalkInSchema, listEncountersQuerySchema } from './opd.validators.js';
import { opdService } from './opd.service.js';

export const opdRouter = Router();

opdRouter.get(
  '/encounters',
  requirePermission(PERMISSIONS.CONSULTATION_READ),
  asyncHandler(async (req, res) => {
    const q = listEncountersQuerySchema.parse(req.query);
    res.json(await opdService.list(req.auth!, getAccessToken(req), q));
  }),
);

opdRouter.post(
  '/encounters',
  requirePermission(PERMISSIONS.CONSULTATION_WRITE),
  asyncHandler(async (req, res) => {
    const input = createWalkInSchema.parse(req.body);
    res.status(201).json(await opdService.createWalkIn(req.auth!, getAccessToken(req), input));
  }),
);

opdRouter.get(
  '/encounters/:id',
  requirePermission(PERMISSIONS.CONSULTATION_READ),
  asyncHandler(async (req, res) => {
    res.json(await opdService.getById(req.auth!, getAccessToken(req), req.params.id!));
  }),
);

opdRouter.put(
  '/encounters/:id',
  requirePermission(PERMISSIONS.CONSULTATION_WRITE),
  asyncHandler(async (req, res) => {
    const input = saveEncounterSchema.parse(req.body);
    res.json(await opdService.save(req.auth!, getAccessToken(req), req.params.id!, input));
  }),
);