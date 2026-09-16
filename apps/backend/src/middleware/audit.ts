import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestHandler } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../config/logger.js';

interface AuditCtx {
  tenantId: string | null;
  userId: string | null;
}

const als = new AsyncLocalStorage<AuditCtx>();

/**
 * Wraps every downstream handler in an AsyncLocalStorage context
 * carrying tenant + user from the JWT. audit() reads from here
 * automatically — callers no longer need to pass tenantId.
 * Must be mounted AFTER authenticate.
 */
export const auditContextMiddleware: RequestHandler = (req, _res, next) => {
  const ctx: AuditCtx = {
    tenantId: req.auth?.tenantId ?? null,
    userId: req.auth?.userId ?? null,
  };
  als.run(ctx, () => next());
};

export async function audit(opts: {
  actorUserId?: string | null;
  tenantId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  const ctx = als.getStore();
  try {
    await supabaseAdmin.from('platform_audit_logs').insert({
      actor_user_id: opts.actorUserId ?? ctx?.userId ?? null,
      tenant_id: opts.tenantId ?? ctx?.tenantId ?? null,
      action: opts.action,
      entity: opts.entity,
      entity_id: opts.entityId ?? null,
      before_state: opts.before ?? null,
      after_state: opts.after ?? null,
    });
  } catch (err) {
    logger.error({ err, ...opts }, 'Audit log write failed');
  }
}