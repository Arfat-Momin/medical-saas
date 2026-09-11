import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requirePermission } from '../../middleware/permissions.js';
import { getAccessToken } from '../../middleware/auth.js';
import { PERMISSIONS } from '@medical/shared';
import {
  createPatientSchema,
  updatePatientSchema,
  listPatientsQuerySchema,
  checkDuplicateSchema,
} from './patients.validators.js';
import { patientsService } from './patients.service.js';
import { z } from 'zod';

export const patientsRouter = Router();

patientsRouter.get(
  '/',
  requirePermission(PERMISSIONS.PATIENT_READ),
  asyncHandler(async (req, res) => {
    const query = listPatientsQuerySchema.parse(req.query);
    res.json(await patientsService.list(req.auth!, getAccessToken(req), query));
  }),
);

patientsRouter.post(
  '/check-duplicate',
  requirePermission(PERMISSIONS.PATIENT_CREATE),
  asyncHandler(async (req, res) => {
    const input = checkDuplicateSchema.parse(req.body);
    res.json(await patientsService.checkDuplicate(req.auth!, getAccessToken(req), input));
  }),
);

patientsRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.PATIENT_READ),
  asyncHandler(async (req, res) => {
    res.json(await patientsService.getById(req.auth!, getAccessToken(req), req.params.id!));
  }),
);

patientsRouter.post(
  '/',
  requirePermission(PERMISSIONS.PATIENT_CREATE),
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const skip = Boolean(body?.skipDuplicateCheck);
    delete body?.skipDuplicateCheck;
    const input = createPatientSchema.parse(body);
    res.status(201).json(await patientsService.create(req.auth!, getAccessToken(req), input, skip));
  }),
);

patientsRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.PATIENT_UPDATE),
  asyncHandler(async (req, res) => {
    const patch = updatePatientSchema.parse(req.body);
    res.json(await patientsService.update(req.auth!, getAccessToken(req), req.params.id!, patch));
  }),
);