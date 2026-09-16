import { supabaseForUser } from '../../config/supabase.js';
import { rolesRepository } from './roles.repository.js';
import { Conflict, NotFound } from '../../utils/errors.js';
import { audit } from '../../middleware/audit.js';
import { PERMISSIONS } from '@medical/shared';
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
     * SECURITY: refuse to remove ROLE_MANAGE from the last role that
     * holds it. Without this guard a Hospital Admin can uncheck
     * "Manage roles & permissions" on their own role and permanently
     * lock every admin in the tenant out of role editing.
     */
    async updatePermissions(auth: AuthContext, token: string, id: string, permissions: string[]) {
        if (!auth.tenantId) throw NotFound('No tenant context');
        const client = supabaseForUser(token);

        const before = await rolesRepository.findById(client, auth.tenantId, id);
        if (!before) throw NotFound('Role not found');

        const hadManage = (before.permissions ?? []).includes(PERMISSIONS.ROLE_MANAGE);
        const willHaveManage = permissions.includes(PERMISSIONS.ROLE_MANAGE);

        if (hadManage && !willHaveManage) {
            const siblings = await rolesRepository.list(client, auth.tenantId);
            const otherRoleWithManage = siblings.some(
                (r) => r.id !== id && (r.permissions ?? []).includes(PERMISSIONS.ROLE_MANAGE),
            );
            if (!otherRoleWithManage) {
                throw Conflict(
                    'Cannot remove “Manage roles & permissions” from the last role that holds it. ' +
                    'Grant it to another role first.',
                );
            }
        }

        const after = await rolesRepository.updatePermissions(client, auth.tenantId, id, permissions);

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