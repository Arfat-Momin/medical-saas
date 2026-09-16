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

function firstRelation<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return (rel[0] as T) ?? null;
  return rel as T;
}

interface RoleRow {
  code: string;
  permissions: string[] | null;
}

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw Unauthorized('Missing bearer token');

    const token = header.slice(7);

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) throw Unauthorized('Invalid or expired token');

    const userId = data.user.id;

    const { data: profile, error: profErr } = await supabaseAdmin
      .from('users')
      .select('id, email, is_platform_admin, is_active')
      .eq('id', userId)
      .maybeSingle();

    if (profErr) throw Unauthorized('Failed to verify user');
    if (!profile) throw Unauthorized('User profile not found');
    if (profile.is_active === false) throw Unauthorized('Account disabled');

    const isPlatformAdmin = profile.is_platform_admin === true;

    const jwt = decodeJwtPayload(token);

    let tenantId: string | null = null;
    let roles: string[] = [];
    let permissions: string[] = [];
    let hasTenantMembership = false;

    if (isPlatformAdmin) {
      tenantId = null;
      hasTenantMembership = false;
      roles = ['SUPER_ADMIN'];
      permissions = [...DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN];
    } else {
      const requestedTenantId = (jwt.tenant_id as string | undefined) ?? null;

      if (requestedTenantId) {
        const { data: memberships, error: memErr } = await supabaseAdmin
          .from('memberships')
          .select('roles:role_id ( code, permissions )')
          .eq('user_id', userId)
          .eq('tenant_id', requestedTenantId)
          .eq('is_active', true);

        if (memErr) throw Unauthorized('Failed to verify membership');

        if (memberships && memberships.length > 0) {
          tenantId = requestedTenantId;
          hasTenantMembership = true;

          const roleRows: RoleRow[] = memberships
            .map((m: any) => firstRelation(m.roles))
            .filter(
              (r: any): r is RoleRow =>
                r && typeof r.code === 'string',
            );

          roles = roleRows.map((r) => r.code);

          /*
           * SECURITY: distinguish "never configured" (null / undefined)
           * from "explicitly set to empty array".
           *
           *   permissions == null   -> use DEFAULT_ROLE_PERMISSIONS for
           *                            this role (backwards compatibility
           *                            with tenants provisioned before
           *                            per-role permissions were stored).
           *   permissions == []     -> admin intentionally disabled this
           *                            role. Contribute NOTHING.
           *   permissions == [...]  -> contribute exactly what is stored.
           *
           * The previous implementation collapsed null and [] into the
           * same value, so an admin unchecking every box still got the
           * role's full default permissions on next login. That was a
           * silent privilege grant.
           */
          const permsSet = new Set<string>();
          for (const r of roleRows) {
            if (r.permissions == null) {
              for (const p of DEFAULT_ROLE_PERMISSIONS[r.code as never] ?? []) {
                permsSet.add(p);
              }
            } else {
              for (const p of r.permissions) {
                if (typeof p === 'string' && p.length > 0) permsSet.add(p);
              }
            }
          }
          permissions = Array.from(permsSet);
        }
      }
    }

    req.auth = {
      userId,
      email: data.user.email ?? profile.email ?? '',
      tenantId,
      isPlatformAdmin,
      roles,
      permissions,
      hasTenantMembership,
    };

    next();
  } catch (e) {
    next(e);
  }
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

export function getAccessToken(req: Request): string {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) throw Unauthorized();
  return h.slice(7);
}