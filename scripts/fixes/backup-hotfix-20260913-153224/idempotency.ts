import type { RequestHandler, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';

export const idempotent: RequestHandler = async (req, res, next) => {
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
    return originalJson(body);
  }) as Response['json'];

  next();
};