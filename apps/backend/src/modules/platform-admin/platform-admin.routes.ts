import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  listTenantsQuerySchema, updateTenantSchema, extendSubscriptionSchema,
  createPlanSchema, updatePlanSchema,
} from './platform-admin.validators.js';
import { platformAdminService } from './platform-admin.service.js';

export const platformAdminRouter = Router();

// ---- Tenants ----
platformAdminRouter.get('/tenants',
  asyncHandler(async (req, res) => {
    const q = listTenantsQuerySchema.parse(req.query);
    res.json(await platformAdminService.listTenants(req.auth!, q));
  }),
);

platformAdminRouter.get('/tenants/:id',
  asyncHandler(async (req, res) => {
    res.json(await platformAdminService.getTenant(req.auth!, req.params.id!));
  }),
);

platformAdminRouter.patch('/tenants/:id',
  asyncHandler(async (req, res) => {
    const patch = updateTenantSchema.parse(req.body);
    res.json(await platformAdminService.updateTenant(req.auth!, req.params.id!, patch));
  }),
);

platformAdminRouter.post('/tenants/:id/extend-subscription',
  asyncHandler(async (req, res) => {
    const input = extendSubscriptionSchema.parse(req.body);
    res.json(await platformAdminService.extendSubscription(req.auth!, req.params.id!, input));
  }),
);

// ---- Plans ----
platformAdminRouter.get('/plans',
  asyncHandler(async (req, res) => {
    res.json(await platformAdminService.listPlans(req.auth!));
  }),
);

platformAdminRouter.post('/plans',
  asyncHandler(async (req, res) => {
    const input = createPlanSchema.parse(req.body);
    res.status(201).json(await platformAdminService.createPlan(req.auth!, input));
  }),
);

platformAdminRouter.patch('/plans/:id',
  asyncHandler(async (req, res) => {
    const patch = updatePlanSchema.parse(req.body);
    res.json(await platformAdminService.updatePlan(req.auth!, req.params.id!, patch));
  }),
);

// ---- Dashboard ----
platformAdminRouter.get('/dashboard',
  asyncHandler(async (req, res) => {
    res.json(await platformAdminService.dashboard(req.auth!));
  }),
);