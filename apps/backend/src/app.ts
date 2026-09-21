import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';

import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { requestId } from './middleware/requestId.js';
import { authenticate } from './middleware/auth.js';
import { globalApiLimiter } from './middleware/rateLimit.js';
import { supabaseAdmin } from './config/supabase.js';
import { requireTenant, requirePlatformAdmin } from './middleware/tenantContext.js';
import { idempotent } from './middleware/idempotency.js';
import { auditContextMiddleware } from './middleware/audit.js';
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

  // CRITICAL: trust the first hop of X-Forwarded-For so req.ip is
  // the real client IP when we run behind Vercel, nginx, Cloudflare, etc.
  // Without this, every user shares a single rate-limit bucket.
  app.set('trust proxy', 1);

  app.use(requestId);
  app.use(pinoHttp({ logger, genReqId: (req) => (req as any).id }));
  app.use(helmet());
  const corsOrigins = env.CORS_ORIGIN
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

  app.use(cors({ origin: corsOrigins, credentials: true }));

  app.use(
    '/api/v1/subscriptions/webhook',
    express.raw({ type: 'application/json', limit: '1mb' }),
    razorpayWebhookRouter,
  );

  app.use(express.json({ limit: '2mb' }));

  // DB-aware health check with a 5-second cache so uptime monitors don't
  // hammer Supabase. Returns 200 when the DB is reachable, 503 otherwise,
  // so orchestrators can actually tell the difference.
  let lastHealthAt = 0;
  let lastHealthStatus: 'ok' | 'degraded' = 'ok';
  let lastHealthError: string | null = null;

  app.get('/health', async (_req, res) => {
    const ts = new Date().toISOString();
    const now = Date.now();

    if (now - lastHealthAt < 5000) {
      return res.status(lastHealthStatus === 'ok' ? 200 : 503).json({
        status: lastHealthStatus,
        service: 'medical-saas-backend',
        ts,
        ...(lastHealthError ? { error: lastHealthError } : {}),
      });
    }

    lastHealthAt = now;
    try {
      const { error } = await supabaseAdmin
        .from('tenants')
        .select('id', { count: 'exact', head: true })
        .limit(1);

      if (error) {
        lastHealthStatus = 'degraded';
        lastHealthError = error.message;
        return res.status(503).json({
          status: 'degraded',
          service: 'medical-saas-backend',
          ts,
          error: error.message,
        });
      }

      lastHealthStatus = 'ok';
      lastHealthError = null;
      return res.json({ status: 'ok', service: 'medical-saas-backend', ts });
    } catch (e: any) {
      lastHealthStatus = 'degraded';
      lastHealthError = e?.message ?? 'unknown error';
      return res.status(503).json({
        status: 'degraded',
        service: 'medical-saas-backend',
        ts,
        error: lastHealthError,
      });
    }
  });

  const api = express.Router();

  api.use('/auth', authRouter);
  api.use('/subscriptions', subscriptionsRouter);

  api.use(authenticate);
  api.use(globalApiLimiter);
  api.use(auditContextMiddleware);
  api.use(idempotent);

  api.use('/platform', requirePlatformAdmin, platformAdminRouter);

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
