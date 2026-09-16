import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requirePermission } from '../../middleware/permissions.js';
import { getAccessToken } from '../../middleware/auth.js';
import { PERMISSIONS } from '@medical/shared';
import { pharmacyQueueService } from './pharmacy-queue.service.js';
import { z } from 'zod';

const listQuerySchema = z.object({
  status: z.enum(['PENDING','DISPENSED','CANCELLED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

const markDispensedSchema = z.object({
  dispenseId: z.string().uuid(),
});

export const pharmacyQueueRouter = Router();

pharmacyQueueRouter.get(
  '/',
  requirePermission(PERMISSIONS.PHARMACY_READ),
  asyncHandler(async (req, res) => {
    const q = listQuerySchema.parse(req.query);
    res.json(await pharmacyQueueService.list(req.auth!, getAccessToken(req), q));
  }),
);

pharmacyQueueRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.PHARMACY_READ),
  asyncHandler(async (req, res) => {
    res.json(await pharmacyQueueService.getById(req.auth!, getAccessToken(req), req.params.id!));
  }),
);

pharmacyQueueRouter.post(
  '/:id/dispensed',
  requirePermission(PERMISSIONS.PHARMACY_DISPENSE),
  asyncHandler(async (req, res) => {
    const input = markDispensedSchema.parse(req.body);
    res.json(await pharmacyQueueService.markDispensed(req.auth!, getAccessToken(req), req.params.id!, input));
  }),
);

pharmacyQueueRouter.post(
  '/:id/cancel',
  requirePermission(PERMISSIONS.PHARMACY_DISPENSE),
  asyncHandler(async (req, res) => {
    res.json(await pharmacyQueueService.cancel(req.auth!, getAccessToken(req), req.params.id!));
  }),
);
