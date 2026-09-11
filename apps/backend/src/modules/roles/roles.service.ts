import { supabaseForUser } from '../../config/supabase.js';
import { rolesRepository } from './roles.repository.js';
import { NotFound } from '../../utils/errors.js';
import { audit } from '../../middleware/audit.js';
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

    async updatePermissions(auth: AuthContext, token: string, id: string, permissions: string[]) {
        if (!auth.tenantId) throw NotFound('No tenant context');
        const client = supabaseForUser(token);
        const before = await rolesRepository.findById(client, auth.tenantId, id);
        if (!before) throw NotFound('Role not found');

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