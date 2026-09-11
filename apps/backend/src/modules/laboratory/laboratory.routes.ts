import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requirePermission } from '../../middleware/permissions.js';
import { getAccessToken } from '../../middleware/auth.js';
import { PERMISSIONS } from '@medical/shared';
import {
  createLabTestSchema, updateLabTestSchema, listLabTestsQuerySchema,
  createLabOrderSchema, collectSampleSchema, enterResultsSchema,
  listLabOrdersQuerySchema,
} from './laboratory.validators.js';
import { laboratoryService } from './laboratory.service.js';

export const laboratoryRouter = Router();

// ---- Tests master ----
laboratoryRouter.get('/tests',
  requirePermission(PERMISSIONS.LAB_READ),
  asyncHandler(async (req, res) => {
    const q = listLabTestsQuerySchema.parse(req.query);
    res.json(await laboratoryService.listTests(req.auth!, getAccessToken(req), q));
  }),
);
laboratoryRouter.post('/tests',
  requirePermission(PERMISSIONS.LAB_RESULT_VERIFY),
  asyncHandler(async (req, res) => {
    const input = createLabTestSchema.parse(req.body);
    res.status(201).json(await laboratoryService.createTest(req.auth!, getAccessToken(req), input));
  }),
);
laboratoryRouter.patch('/tests/:id',
  requirePermission(PERMISSIONS.LAB_RESULT_VERIFY),
  asyncHandler(async (req, res) => {
    const patch = updateLabTestSchema.parse(req.body);
    res.json(await laboratoryService.updateTest(req.auth!, getAccessToken(req), req.params.id!, patch));
  }),
);

// ---- Orders ----
laboratoryRouter.get('/orders',
  requirePermission(PERMISSIONS.LAB_READ),
  asyncHandler(async (req, res) => {
    const q = listLabOrdersQuerySchema.parse(req.query);
    res.json(await laboratoryService.listOrders(req.auth!, getAccessToken(req), q));
  }),
);
laboratoryRouter.get('/orders/:id',
  requirePermission(PERMISSIONS.LAB_READ),
  asyncHandler(async (req, res) => {
    res.json(await laboratoryService.getOrder(req.auth!, getAccessToken(req), req.params.id!));
  }),
);
laboratoryRouter.post('/orders',
  requirePermission(PERMISSIONS.LAB_ORDER),
  asyncHandler(async (req, res) => {
    const input = createLabOrderSchema.parse(req.body);
    res.status(201).json(await laboratoryService.createOrder(req.auth!, getAccessToken(req), input));
  }),
);

// ---- Workflow ----
laboratoryRouter.post('/orders/:id/collect',
  requirePermission(PERMISSIONS.LAB_ORDER),
  asyncHandler(async (req, res) => {
    const input = collectSampleSchema.parse(req.body);
    res.json(await laboratoryService.collectSample(req.auth!, getAccessToken(req), req.params.id!, input));
  }),
);
laboratoryRouter.post('/orders/:id/results',
  requirePermission(PERMISSIONS.LAB_RESULT_ENTER),
  asyncHandler(async (req, res) => {
    const input = enterResultsSchema.parse(req.body);
    res.json(await laboratoryService.enterResults(req.auth!, getAccessToken(req), req.params.id!, input));
  }),
);
laboratoryRouter.post('/orders/:id/verify',
  requirePermission(PERMISSIONS.LAB_RESULT_VERIFY),
  asyncHandler(async (req, res) => {
    res.json(await laboratoryService.verifyResults(req.auth!, getAccessToken(req), req.params.id!));
  }),
);