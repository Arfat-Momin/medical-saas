import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requirePermission } from '../../middleware/permissions.js';
import { getAccessToken } from '../../middleware/auth.js';
import { PERMISSIONS } from '@medical/shared';
import {
  createLocationSchema, updateLocationSchema, listLocationsQuerySchema,
  admitPatientSchema, transferBedSchema, dischargeSchema, listAdmissionsQuerySchema,
  createNursingNoteSchema, createDoctorRoundSchema, createMarSchema, markMarSchema,
} from './ipd.validators.js';
import { ipdService } from './ipd.service.js';

export const ipdRouter = Router();

// ---- Locations ----
ipdRouter.get('/locations',
  requirePermission(PERMISSIONS.IPD_READ),
  asyncHandler(async (req, res) => {
    const q = listLocationsQuerySchema.parse(req.query);
    res.json(await ipdService.listLocations(req.auth!, getAccessToken(req), q));
  }),
);
ipdRouter.post('/locations',
  requirePermission(PERMISSIONS.IPD_MANAGE),
  asyncHandler(async (req, res) => {
    const input = createLocationSchema.parse(req.body);
    res.status(201).json(await ipdService.createLocation(req.auth!, getAccessToken(req), input));
  }),
);
ipdRouter.patch('/locations/:id',
  requirePermission(PERMISSIONS.IPD_MANAGE),
  asyncHandler(async (req, res) => {
    const patch = updateLocationSchema.parse(req.body);
    res.json(await ipdService.updateLocation(req.auth!, getAccessToken(req), req.params.id!, patch));
  }),
);

ipdRouter.delete('/locations/:id',
  requirePermission(PERMISSIONS.IPD_MANAGE),
  asyncHandler(async (req, res) => {
    res.json(await ipdService.deleteLocation(req.auth!, getAccessToken(req), req.params.id!));
  }),
);

// ---- Beds ----
ipdRouter.get('/beds',
  requirePermission(PERMISSIONS.IPD_READ),
  asyncHandler(async (req, res) => {
    const branchId = req.query.branchId as string | undefined;
    res.json(await ipdService.listBeds(req.auth!, getAccessToken(req), branchId));
  }),
);

// ---- Admissions ----
ipdRouter.get('/admissions',
  requirePermission(PERMISSIONS.IPD_READ),
  asyncHandler(async (req, res) => {
    const q = listAdmissionsQuerySchema.parse(req.query);
    res.json(await ipdService.listAdmissions(req.auth!, getAccessToken(req), q));
  }),
);
ipdRouter.get('/admissions/:id',
  requirePermission(PERMISSIONS.IPD_READ),
  asyncHandler(async (req, res) => {
    res.json(await ipdService.getAdmission(req.auth!, getAccessToken(req), req.params.id!));
  }),
);
ipdRouter.post('/admissions',
  requirePermission(PERMISSIONS.IPD_MANAGE),
  asyncHandler(async (req, res) => {
    const input = admitPatientSchema.parse(req.body);
    res.status(201).json(await ipdService.admit(req.auth!, getAccessToken(req), input));
  }),
);
ipdRouter.post('/admissions/:id/transfer',
  requirePermission(PERMISSIONS.IPD_MANAGE),
  asyncHandler(async (req, res) => {
    const input = transferBedSchema.parse(req.body);
    res.json(await ipdService.transfer(req.auth!, getAccessToken(req), req.params.id!, input));
  }),
);
ipdRouter.post('/admissions/:id/discharge',
  requirePermission(PERMISSIONS.IPD_MANAGE),
  asyncHandler(async (req, res) => {
    const input = dischargeSchema.parse(req.body);
    res.json(await ipdService.discharge(req.auth!, getAccessToken(req), req.params.id!, input));
  }),
);

// ---- Nursing notes ----
ipdRouter.post('/admissions/:id/nursing-notes',
  requirePermission(PERMISSIONS.IPD_MANAGE),
  asyncHandler(async (req, res) => {
    const input = createNursingNoteSchema.parse(req.body);
    res.status(201).json(await ipdService.createNursingNote(req.auth!, getAccessToken(req), req.params.id!, input));
  }),
);

// ---- Doctor rounds ----
ipdRouter.post('/admissions/:id/rounds',
  requirePermission(PERMISSIONS.IPD_MANAGE),
  asyncHandler(async (req, res) => {
    const input = createDoctorRoundSchema.parse(req.body);
    res.status(201).json(await ipdService.createDoctorRound(req.auth!, getAccessToken(req), req.params.id!, input));
  }),
);

// ---- MAR ----
ipdRouter.post('/admissions/:id/mar',
  requirePermission(PERMISSIONS.MAR_WRITE),
  asyncHandler(async (req, res) => {
    const input = createMarSchema.parse(req.body);
    res.status(201).json(await ipdService.createMar(req.auth!, getAccessToken(req), req.params.id!, input));
  }),
);
ipdRouter.patch('/mar/:marId',
  requirePermission(PERMISSIONS.MAR_WRITE),
  asyncHandler(async (req, res) => {
    const input = markMarSchema.parse(req.body);
    res.json(await ipdService.markMar(req.auth!, getAccessToken(req), req.params.marId!, input));
  }),
);