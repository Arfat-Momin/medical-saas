import { supabaseForUser } from '../../config/supabase.js';
import { branchesRepository } from './branches.repository.js';
import { NotFound } from '../../utils/errors.js';
import { audit } from '../../middleware/audit.js';
import type { AuthContext } from '@medical/shared';
import type { CreateBranchInput, UpdateBranchInput } from './branches.validators.js';

export const branchesService = {
    async list(auth: AuthContext, token: string, activeOnly: boolean) {
        if (!auth.tenantId) throw NotFound('No tenant context');
        const client = supabaseForUser(token);
        return branchesRepository.list(client, auth.tenantId, activeOnly);
    },

    async getById(auth: AuthContext, token: string, id: string) {
        if (!auth.tenantId) throw NotFound('No tenant context');
        const client = supabaseForUser(token);
        const branch = await branchesRepository.findById(client, auth.tenantId, id);
        if (!branch) throw NotFound('Branch not found');
        return branch;
    },

    async create(auth: AuthContext, token: string, input: CreateBranchInput) {
        if (!auth.tenantId) throw NotFound('No tenant context');
        const client = supabaseForUser(token);

        const org = await branchesRepository.findOrganization(client, auth.tenantId);
        if (!org) throw NotFound('Organization not found');

        const branch = await branchesRepository.create(client, {
            tenant_id: auth.tenantId,
            organization_id: org.id,
            name: input.name,
            address: input.address ?? null,
            city: input.city ?? null,
            state: input.state ?? null,
            pincode: input.pincode ?? null,
            phone: input.phone ?? null,
        });

        await audit({
            actorUserId: auth.userId,
            action: 'BRANCH_CREATED',
            entity: 'branches',
            entityId: branch.id,
            after: branch,
        });

        return branch;
    },

    async update(auth: AuthContext, token: string, id: string, patch: UpdateBranchInput) {
        if (!auth.tenantId) throw NotFound('No tenant context');
        const client = supabaseForUser(token);

        const before = await branchesRepository.findById(client, auth.tenantId, id);
        if (!before) throw NotFound('Branch not found');

        const dbPatch: Record<string, unknown> = {};
        if (patch.name !== undefined) dbPatch.name = patch.name;
        if (patch.address !== undefined) dbPatch.address = patch.address;
        if (patch.city !== undefined) dbPatch.city = patch.city;
        if (patch.state !== undefined) dbPatch.state = patch.state;
        if (patch.pincode !== undefined) dbPatch.pincode = patch.pincode;
        if (patch.phone !== undefined) dbPatch.phone = patch.phone;
        if (patch.isActive !== undefined) dbPatch.is_active = patch.isActive;

        const after = await branchesRepository.update(client, auth.tenantId, id, dbPatch);

        await audit({
            actorUserId: auth.userId,
            action: 'BRANCH_UPDATED',
            entity: 'branches',
            entityId: id,
            before,
            after,
        });

        return after;
    },
};