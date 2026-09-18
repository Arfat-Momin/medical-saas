import type { RequestHandler } from 'express';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError, Forbidden } from '../utils/errors.js';

interface SubscriptionRuntime {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  isFreeTier: boolean;
}

interface TenantRuntimeState {
  tenantStatus: string;
  subscription: SubscriptionRuntime | null;
}

interface CachedState {
  state: TenantRuntimeState;
  expiresAt: number;
}

const stateCache = new Map<string, CachedState>();
const TTL_MS = 30_000;

function freshClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getTenantState(tenantId: string): Promise<TenantRuntimeState | null> {
  const cached = stateCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) return cached.state;

  for (let attempt = 1 as 1 | 2; attempt <= 2; attempt = (attempt + 1) as 1 | 2) {
    const client = attempt === 1 ? supabaseAdmin : freshClient();
    const started = Date.now();
    try {
      const [tenantRes, subRes] = await Promise.all([
        client.from('tenants').select('id, status').eq('id', tenantId).maybeSingle(),
        client
          .from('subscriptions')
          .select('id, status, starts_at, ends_at, is_free_tier')
          .eq('tenant_id', tenantId)
          .in('status', ['ACTIVE', 'TRIAL', 'GRACE'])
          .order('ends_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (tenantRes.error || !tenantRes.data) {
        console.warn('[tenantContext] miss', {
          pid: process.pid,
          attempt,
          tenantId,
          ms: Date.now() - started,
          errCode: (tenantRes.error as any)?.code,
          errMsg: (tenantRes.error as any)?.message,
        });
        if (attempt === 1) continue;
        return null;
      }

      const state: TenantRuntimeState = {
        tenantStatus: tenantRes.data.status,
        subscription: subRes.data
          ? {
              id: subRes.data.id,
              status: subRes.data.status,
              startsAt: subRes.data.starts_at,
              endsAt: subRes.data.ends_at,
              isFreeTier: !!subRes.data.is_free_tier,
            }
          : null,
      };

      stateCache.set(tenantId, { state, expiresAt: Date.now() + TTL_MS });
      return state;
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
  stateCache.delete(tenantId);
}

// Endpoints that MUST remain reachable when the subscription is expired,
// otherwise the user can never see their expiry or pay to renew.
const RENEWAL_ALLOWED_PATHS = new Set<string>([
  '/api/v1/subscriptions/current',
  '/api/v1/subscriptions/renew',
  '/api/v1/subscriptions/verify-renewal',
]);

function isRenewalAllowedPath(originalUrl: string): boolean {
  const clean = originalUrl.split('?')[0] ?? '';
  return RENEWAL_ALLOWED_PATHS.has(clean);
}

function isSubscriptionActive(sub: SubscriptionRuntime | null): boolean {
  if (!sub) return false;
  if (sub.status !== 'ACTIVE' && sub.status !== 'TRIAL') return false;
  const now = Date.now();
  const endsAt = new Date(sub.endsAt).getTime();
  const startsAt = new Date(sub.startsAt).getTime();
  if (!Number.isFinite(endsAt) || !Number.isFinite(startsAt)) return false;
  return startsAt <= now && endsAt > now;
}

export const requireTenant: RequestHandler = async (req, _res, next) => {
  try {
    if (req.auth?.isPlatformAdmin) {
      return next(Forbidden('Platform admin cannot access hospital data'));
    }
    if (!req.auth?.tenantId) {
      return next(Forbidden('No tenant context'));
    }
    if (!req.auth.hasTenantMembership) {
      return next(Forbidden('Not an active member of this tenant'));
    }

    const state = await getTenantState(req.auth.tenantId);
    if (!state) return next(Forbidden('Tenant not found'));

    if (state.tenantStatus === 'SUSPENDED' || state.tenantStatus === 'CANCELLED') {
      return next(
        Forbidden(`Tenant is ${state.tenantStatus.toLowerCase()}. Please contact support.`),
      );
    }

    if (!isSubscriptionActive(state.subscription)) {
      const url = req.originalUrl ?? req.url ?? '';
      if (!isRenewalAllowedPath(url)) {
        return next(
          new AppError(
            403,
            'SUBSCRIPTION_EXPIRED',
            'Subscription expired. Please renew to continue.',
            {
              reason: state.subscription ? 'expired' : 'missing',
              endsAt: state.subscription?.endsAt ?? null,
              isFreeTier: state.subscription?.isFreeTier ?? null,
            },
          ),
        );
      }
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
