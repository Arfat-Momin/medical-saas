import { supabaseForUser } from '../../config/supabase.js';
import { organizationsRepository } from './organizations.repository.js';
import { NotFound } from '../../utils/errors.js';
import { audit } from '../../middleware/audit.js';
import type { AuthContext } from '@medical/shared';
import type { UpdateOrganizationInput } from './organizations.validators.js';

export const organizationsService = {
    async getMine(auth: AuthContext, token: string) {
        if (!auth.tenantId) throw NotFound('No tenant context');
        const client = supabaseForUser(token);
        const org = await organizationsRepository.findByTenantId(client, auth.tenantId);
        if (!org) throw NotFound('Organization not found');
        return org;
    },

    async updateMine(auth: AuthContext, token: string, patch: UpdateOrganizationInput) {
        if (!auth.tenantId) throw NotFound('No tenant context');
        const client = supabaseForUser(token);
        const org = await organizationsRepository.findByTenantId(client, auth.tenantId);
        if (!org) throw NotFound('Organization not found');

        const updated = await organizationsRepository.update(client, org.id, patch);

        await audit({
            actorUserId: auth.userId,
            action: 'ORGANIZATION_UPDATED',
            entity: 'organizations',
            entityId: org.id,
            before: org,
            after: updated,
        });

        return updated;
    },
};