import { supabaseForUser } from '../../config/supabase.js';
import { rolesRepository } from './roles.repository.js';
import { Conflict, Forbidden, NotFound } from '../../utils/errors.js';
import { audit } from '../../middleware/audit.js';
import { PERMISSIONS, PLATFORM_ONLY_PERMISSIONS } from '@medical/shared';
import type { AuthContext } from '@medical/shared';

export const rolesService = {
    async list(auth: AuthContext, token: string) {
        if (!auth.tenantId) throw NotFound('No tenant context');
        const client = supabaseForUser(token);
        return rolesRepository.list(client, auth.tenantId);
    },

    async getById(auth: AuthContext, token: string, id: string) {
        if (!auth.tenantId) throw NotFound('No tenant context');
        const client = supabaseForUser(token);
        const role = await rolesRepository.findById(client, auth.tenantId, id);
        if (!role) throw NotFound('Role not found');
        return role;
    },

    /**
     * Update a role's permission set.
     *
     * SECURITY — three independent guards, evaluated in order:
     *
     *   1. Privilege escalation prevention.
     *      The caller cannot grant a permission they do not themselves
     *      hold. Stops a lower-privileged role (e.g. one that only has
     *      ROLE_MANAGE) from granting itself BILLING_REFUND, IPD_MANAGE,
     *      or anything else it does not already have.
     *
     *   2. Platform-permission isolation.
     *      A tenant role must never carry a platform:* capability.
     *      Rejected here as defence-in-depth in case the validator
     *      was bypassed or the schema drifted.
     *
     *   3. Self-lockout prevention.
     *      Refuse to remove ROLE_MANAGE from the last role in the
     *      tenant that holds it. Otherwise the admin permanently locks
     *      every admin out of role editing.
     */
    async updatePermissions(auth: AuthContext, token: string, id: string, permissions: string[]) {
        if (!auth.tenantId) throw NotFound('No tenant context');
        const client = supabaseForUser(token);

        const before = await rolesRepository.findById(client, auth.tenantId, id);
        if (!before) throw NotFound('Role not found');

        const requested = Array.from(new Set(permissions));

        // -------- Guard 1: privilege escalation --------
        const callerPerms = new Set(auth.permissions ?? []);
        const missing = requested.filter((p) => !callerPerms.has(p));
        if (missing.length > 0) {
            throw Forbidden(
                `Cannot grant permissions you do not hold yourself: ${missing.join(', ')}`,
            );
        }

        // -------- Guard 2: platform permission isolation --------
        const leaked = requested.filter((p) => PLATFORM_ONLY_PERMISSIONS.has(p));
        if (leaked.length > 0) {
            throw Forbidden(
                `Platform permissions cannot be assigned to tenant roles: ${leaked.join(', ')}`,
            );
        }

        // -------- Guard 3: self-lockout prevention --------
        const hadManage = (before.permissions ?? []).includes(PERMISSIONS.ROLE_MANAGE);
        const willHaveManage = requested.includes(PERMISSIONS.ROLE_MANAGE);

        if (hadManage && !willHaveManage) {
            const siblings = await rolesRepository.list(client, auth.tenantId);
            const otherRoleWithManage = siblings.some(
                (r) => r.id !== id && (r.permissions ?? []).includes(PERMISSIONS.ROLE_MANAGE),
            );
            if (!otherRoleWithManage) {
                throw Conflict(
                    'Cannot remove "Manage roles & permissions" from the last role that holds it. ' +
                    'Grant it to another role first.',
                );
            }
        }

        const after = await rolesRepository.updatePermissions(client, auth.tenantId, id, requested);

        await audit({
            actorUserId: auth.userId,
            action: 'ROLE_PERMISSIONS_UPDATED',
            entity: 'roles',
            entityId: id,
            before: { permissions: before.permissions },
            after: { permissions: after.permissions },
        });

        return after;
    },
};