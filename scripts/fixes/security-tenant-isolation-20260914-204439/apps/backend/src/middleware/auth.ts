import type { RequestHandler } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { Unauthorized } from '../utils/errors.js';
import type { AuthContext } from '@medical/shared';
import { DEFAULT_ROLE_PERMISSIONS } from '@medical/shared';
import type { Request } from 'express';

declare global {
  namespace Express {
    interface Request { auth?: AuthContext; }
  }
}

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw Unauthorized('Missing bearer token');

    const token = header.slice(7);
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) throw Unauthorized('Invalid or expired token');

    const jwt = decodeJwtPayload(token);
    const tenantId = (jwt.tenant_id as string | undefined) ?? null;
    const isPlatformAdmin = Boolean(jwt.is_platform_admin);

    let roles: string[] = [];
    let permissions: string[] = [];

    if (tenantId) {
      const { data: memberships } = await supabaseAdmin
        .from('memberships')
        .select('roles:role_id ( code, permissions )')
        .eq('user_id', data.user.id)
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      roles = (memberships ?? []).map((m: any) => m.roles?.code).filter(Boolean);
      const explicit = (memberships ?? [])
        .flatMap((m: any) => (m.roles?.permissions ?? []) as string[])
        .filter(Boolean);

      permissions = explicit.length
        ? Array.from(new Set(explicit))
        : Array.from(new Set(roles.flatMap((r) => DEFAULT_ROLE_PERMISSIONS[r as never] ?? [])));
    }

    if (isPlatformAdmin) {
      permissions = [...DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN];
      roles = ['SUPER_ADMIN'];
    }

    req.auth = {
      userId: data.user.id,
      email: data.user.email ?? '',
      tenantId,
      isPlatformAdmin,
      roles,
      permissions,
    };
    next();
  } catch (e) { next(e); }
};

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const part = token.split('.')[1];
    if (!part) return {};
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch { return {}; }
}

export const requireAuth: RequestHandler = (req, _res, next) =>
  req.auth ? next() : next(Unauthorized());

/** Extract the raw JWT from the Authorization header (after authenticate() has run). */
export function getAccessToken(req: Request): string {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) throw Unauthorized();
  return h.slice(7);
}