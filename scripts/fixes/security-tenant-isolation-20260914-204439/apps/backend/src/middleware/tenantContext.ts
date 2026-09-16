import type { RequestHandler } from 'express';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { Forbidden } from '../utils/errors.js';

interface CachedStatus { status: string; expiresAt: number; }
const statusCache = new Map<string, CachedStatus>();
const TTL_MS = 60_000;

/**
 * Build a one-off Supabase client with no shared pool.
 * Used as a retry path when the long-lived admin client returns
 * an empty result — which on Windows usually means the keep-alive
 * socket in the undici pool has died.
 */
function freshClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getTenantStatus(tenantId: string): Promise<string | null> {
  const cached = statusCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) return cached.status;

  // Try the shared client first (fast path). If it returns an error OR
  // throws, retry once with a fresh client — this catches the dead
  // keep-alive socket that otherwise lingers until process restart.
  for (let attempt = 1 as 1 | 2; attempt <= 2; attempt = (attempt + 1) as 1 | 2) {
    const client = attempt === 1 ? supabaseAdmin : freshClient();
    const started = Date.now();
    try {
      const { data, error, status: httpStatus } = await client
        .from('tenants')
        .select('id, status')
        .eq('id', tenantId)
        .maybeSingle();

      const ms = Date.now() - started;
      const errCode = (error as any)?.code;
      const errMsg  = (error as any)?.message;

      if (error || !data) {
        // Log every miss so we can see the difference between
        // "row genuinely missing" and "transport gave up".
        console.warn('[tenantContext] miss', {
          pid: process.pid,
          attempt,
          tenantId,
          ms,
          httpStatus,
          hasData: !!data,
          errCode,
          errMsg,
        });

        if (attempt === 1) continue;   // retry once with a fresh client
        return null;                   // both attempts failed → not found
      }

      // Success — cache and return.
      statusCache.set(tenantId, {
        status: data.status,
        expiresAt: Date.now() + TTL_MS,
      });
      return data.status;
    } catch (e: any) {
      console.error('[tenantContext] throw', {
        pid: process.pid,
        attempt,
        tenantId,
        ms: Date.now() - started,
        msg: e?.message ?? String(e),
      });
      if (attempt === 1) continue;
      return null;
    }
  }
  return null;
}

export function invalidateTenantStatus(tenantId: string): void {
  statusCache.delete(tenantId);
}

export const requireTenant: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.auth?.tenantId) return next(Forbidden('No tenant context'));

    const status = await getTenantStatus(req.auth.tenantId);
    if (!status) return next(Forbidden('Tenant not found'));
    if (status === 'SUSPENDED' || status === 'CANCELLED') {
      return next(Forbidden(`Tenant is ${status.toLowerCase()}. Please contact support.`));
    }
    next();
  } catch (err) {
    next(err);
  }
};

export const requirePlatformAdmin: RequestHandler = (req, _res, next) => {
  if (!req.auth?.isPlatformAdmin) return next(Forbidden('Platform admin only'));
  next();
};

export const requireBranchScope: RequestHandler = (req, _res, next) => {
  const headerBranch = req.headers['x-branch-id'] as string | undefined;
  if (headerBranch) (req as any).branchId = headerBranch;
  next();
};