import type { RequestHandler, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';

/**
 * If a request carries `X-Idempotency-Key`, we look it up in sync_operations.
 *   - If found  return the cached response as-is.
 *   - If not found  wrap res.json to capture status + body, then store it.
 *
 * This makes mobile retries safe: sending the same payload twice never
 * creates duplicate records.
 *
 * Only applies to authenticated tenants; no-op for platform routes.
 */
export const idempotent: RequestHandler = async (req, res, next) => {
  const key = req.headers['x-idempotency-key'] as string | undefined;
  if (!key) return next();

  const auth = req.auth;
  if (!auth?.tenantId) return next();

  // Look up cached response
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

  // Intercept res.json so we can store the response after the handler runs
  const originalJson = res.json.bind(res);
  res.json = ((body: any) => {
    // fire-and-forget insert (don't block the response)
    void (async () => {
      try {
        await supabaseAdmin.from('sync_operations').insert({
          tenant_id: auth.tenantId,
          user_id: auth.userId,
          device_id: (req.headers['x-device-id'] as string) ?? 'unknown',
          idempotency_key: key,
          entity: (req.baseUrl || '') + (req.route?.path || '') || 'unknown',
          operation: req.method,
          response_status: res.statusCode,
          response_body: body ?? {},
        });
      } catch { /* best effort */ }
    })();
    return originalJson(body);
  }) as Response['json'];

  next();
};