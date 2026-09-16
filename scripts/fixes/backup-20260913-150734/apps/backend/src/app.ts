import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';

import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { requestId } from './middleware/requestId.js';
import { authenticate } from './middleware/auth.js';
import { requireTenant, requirePlatformAdmin } from './middleware/tenantContext.js';
import { idempotent } from './middleware/idempotency.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

import { authRouter } from './modules/auth/auth.routes.js';
import { subscriptionsRouter } from './modules/subscriptions/subscriptions.routes.js';
import { razorpayWebhookRouter } from './modules/subscriptions/subscriptions.webhook.js';
import { organizationsRouter } from './modules/organizations/organizations.routes.js';
import { branchesRouter } from './modules/branches/branches.routes.js';
import { departmentsRouter } from './modules/departments/departments.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { rolesRouter } from './modules/roles/roles.routes.js';
import { patientsRouter } from './modules/patients/patients.routes.js';
import { appointmentsRouter } from './modules/appointments/appointments.routes.js';
import { opdRouter } from './modules/opd/opd.routes.js';
import { pharmacyRouter } from './modules/pharmacy/pharmacy.routes.js';
import { pharmacyQueueRouter } from './modules/pharmacy-queue/pharmacy-queue.routes.js';
import { laboratoryRouter } from './modules/laboratory/laboratory.routes.js';
import { billingRouter } from './modules/billing/billing.routes.js';
import { ipdRouter } from './modules/ipd/ipd.routes.js';
import { platformAdminRouter } from './modules/platform-admin/platform-admin.routes.js';
import { syncRouter } from './modules/sync/sync.routes.js';

export function createApp() {
  const app = express();

  // ---- Core middleware ----
  app.use(requestId);
  app.use(pinoHttp({ logger, genReqId: (req) => (req as any).id }));
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(','), credentials: true }));

  // ---- Razorpay webhook (RAW body - MUST be before express.json) ----
  app.use(
    '/api/v1/subscriptions/webhook',
    express.raw({ type: 'application/json', limit: '1mb' }),
    razorpayWebhookRouter,
  );

  // ---- JSON parser for everything else ----
  app.use(express.json({ limit: '2mb' }));

  // ---- Health ----
  app.get('/health', (_req, res) =>
    res.json({ status: 'ok', service: 'medical-saas-backend', ts: new Date().toISOString() }),
  );

  // ---- API v1 router ----
  const api = express.Router();

  // Public routes (no authentication)
  api.use('/auth', authRouter);
  api.use('/subscriptions', subscriptionsRouter);

  // ---- Auth wall - everything below requires a valid JWT ----
  api.use(authenticate);
  api.use(idempotent);    // enable X-Idempotency-Key support for mobile retries

  // Platform (Super Admin only)
  api.use('/platform', requirePlatformAdmin, platformAdminRouter);

  // Hospital-scoped modules (require tenant context)
  api.use('/organizations', requireTenant, organizationsRouter);
  api.use('/branches',      requireTenant, branchesRouter);
  api.use('/departments',   requireTenant, departmentsRouter);
  api.use('/users',         requireTenant, usersRouter);
  api.use('/roles',         requireTenant, rolesRouter);
  api.use('/sync',          requireTenant, syncRouter);
  api.use('/patients',      requireTenant, patientsRouter);
  api.use('/appointments',  requireTenant, appointmentsRouter);
  api.use('/opd',           requireTenant, opdRouter);
  api.use('/pharmacy',      requireTenant, pharmacyRouter);
  api.use('/pharmacy-queue', requireTenant, pharmacyQueueRouter);
  api.use('/laboratory',    requireTenant, laboratoryRouter);
  api.use('/billing',       requireTenant, billingRouter);
  api.use('/ipd',           requireTenant, ipdRouter);

  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
