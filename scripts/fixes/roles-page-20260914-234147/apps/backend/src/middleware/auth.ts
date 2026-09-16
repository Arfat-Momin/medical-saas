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

/**
 * Supabase nested relations may come back as an object OR an array
 * depending on FK cardinality. Normalize to a single value or null.
 */
function firstRelation<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return (rel[0] as T) ?? null;
  return rel as T;
}

/**
 * SECURITY: this middleware is the single source of truth for
 * authentication. It no longer trusts the JWT claims `tenant_id` or
 * `is_platform_admin`.
 *
 * Steps:
 *   1. Verify the JWT with Supabase Auth (revoked / expired → reject).
 *   2. Load the user profile from `public.users` and reject if the
 *      account is disabled.
 *   3. Read `is_platform_admin` FROM THE DATABASE (not the JWT).
 *   4. If the user is a platform admin → force tenantId = null.
 *      Platform admins must NEVER ride a stale tenant claim into
 *      hospital data.
 *   5. If the user is not a platform admin → require an ACTIVE
 *      membership in the tenant that the JWT requested. If the
 *      membership does not exist, tenantId stays null and
 *      `requireTenant` will reject every hospital route.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw Unauthorized('Missing bearer token');

    const token = header.slice(7);

    // 1. Verify the JWT is real & not expired.
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) throw Unauthorized('Invalid or expired token');

    const userId = data.user.id;

    // 2. Load the profile. is_active is enforced here.
    const { data: profile, error: profErr } = await supabaseAdmin
      .from('users')
      .select('id, email, is_platform_admin, is_active')
      .eq('id', userId)
      .maybeSingle();

    if (profErr) throw Unauthorized('Failed to verify user');
    if (!profile) throw Unauthorized('User profile not found');
    if (profile.is_active === false) throw Unauthorized('Account disabled');

    // 3. Platform admin flag comes from the DB, not the JWT.
    const isPlatformAdmin = profile.is_platform_admin === true;

    const jwt = decodeJwtPayload(token);

    let tenantId: string | null = null;
    let roles: string[] = [];
    let permissions: string[] = [];
    let hasTenantMembership = false;

    if (isPlatformAdmin) {
      // 4. Platform admins are tenant-less by design.
      tenantId = null;
      hasTenantMembership = false;
      roles = ['SUPER_ADMIN'];
      permissions = [...DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN];
    } else {
      // 5. Non-platform user → require an ACTIVE membership.
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

          roles = memberships
            .map((m: any) => firstRelation(m.roles)?.code)
            .filter((c: any): c is string => typeof c === 'string' && c.length > 0);

          const explicit = memberships
            .flatMap((m: any) => (firstRelation(m.roles)?.permissions ?? []) as string[])
            .filter(Boolean);

          permissions = explicit.length
            ? Array.from(new Set(explicit))
            : Array.from(
                new Set(
                  roles.flatMap((r) => DEFAULT_ROLE_PERMISSIONS[r as never] ?? []),
                ),
              );
        }
        // If there is no active membership, tenantId / hasTenantMembership
        // stay null / false → requireTenant will reject hospital routes.
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

/** Extract the raw JWT from the Authorization header (after authenticate() has run). */
export function getAccessToken(req: Request): string {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) throw Unauthorized();
  return h.slice(7);
}