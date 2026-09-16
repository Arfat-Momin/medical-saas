import type { RequestHandler, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../config/logger.js';

/**
 * Cleanup: sync_operations is a cache of idempotency responses. Without
 * a TTL it grows forever. We keep 7 days of history (well past any real
 * client retry window) and prune the rest.
 *
 * Runs in-process at most once per hour. For large deployments, swap
 * this for a Postgres cron (pg_cron) so every backend replica doesn't
 * race on the same delete.
 */
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const RETENTION_DAYS = 7;
let lastCleanup = 0;

async function maybeCleanup(): Promise<void> {
  if (Date.now() - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = Date.now();
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabaseAdmin
      .from('sync_operations')
      .delete()
      .lt('created_at', cutoff);
    if (error) {
      logger.warn({ err: error }, 'sync_operations cleanup failed');
    }
  } catch (err) {
    logger.warn({ err }, 'sync_operations cleanup threw');
  }
}

export const idempotent: RequestHandler = async (req, res, next) => {
  // Fire-and-forget cleanup on every request (self-throttled to 1/hr).
  void maybeCleanup();

  const key = req.headers['x-idempotency-key'] as string | undefined;
  if (!key) return next();

  const auth = req.auth;
  if (!auth?.tenantId) return next();

  const { data: existing } = await supabaseAdmin
    .from('sync_operations')
    .select('response_status, response_body')
    .eq('tenant_id', auth.tenantId)
    .eq('idempotency_key', key)
    .maybeSingle();

  if (existing) {
    res.setHeader('X-Idempotent-Replay', 'true');
    return res.status(existing.response_status).json(existing.response_body);
  }

  const originalJson = res.json.bind(res);
  res.json = ((body: any) => {
    const shouldCache = res.statusCode >= 200 && res.statusCode < 300;
    if (shouldCache) {
      const entity = req.originalUrl.split('?')[0] || 'unknown';
      void (async () => {
        try {
          await supabaseAdmin.from('sync_operations').insert({
            tenant_id: auth.tenantId,
            user_id: auth.userId,
            device_id: (req.headers['x-device-id'] as string) ?? 'unknown',
            idempotency_key: key,
            entity,
            operation: req.method,
            response_status: res.statusCode,
            response_body: body ?? {},
          });
        } catch { /* best effort */ }
      })();
    }
    return originalJson(body);
  }) as Response['json'];

  next();
};