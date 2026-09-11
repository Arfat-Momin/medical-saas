import { supabaseForUser } from '../../config/supabase.js';
import { departmentsRepository } from './departments.repository.js';
import { NotFound } from '../../utils/errors.js';
import { audit } from '../../middleware/audit.js';
import type { AuthContext } from '@medical/shared';
import type { CreateDepartmentInput, UpdateDepartmentInput } from './departments.validators.js';

export const departmentsService = {
    async list(auth: AuthContext, token: string, branchId: string | undefined, activeOnly: boolean) {
        if (!auth.tenantId) throw NotFound('No tenant context');
        const client = supabaseForUser(token);
        return departmentsRepository.list(client, auth.tenantId, branchId, activeOnly);
    },

    async create(auth: AuthContext, token: string, input: CreateDepartmentInput) {
        if (!auth.tenantId) throw NotFound('No tenant context');
        const client = supabaseForUser(token);
        const dept = await departmentsRepository.create(client, {
            tenant_id: auth.tenantId,
            branch_id: input.branchId,
            name: input.name,
        });
        await audit({
            actorUserId: auth.userId,
            action: 'DEPARTMENT_CREATED',
            entity: 'departments',
            entityId: dept.id,
            after: dept,
        });
        return dept;
    },

    async update(auth: AuthContext, token: string, id: string, patch: UpdateDepartmentInput) {
        if (!auth.tenantId) throw NotFound('No tenant context');
        const client = supabaseForUser(token);
        const before = await departmentsRepository.findById(client, auth.tenantId, id);
        if (!before) throw NotFound('Department not found');

        const dbPatch: Record<string, unknown> = {};
        if (patch.name !== undefined) dbPatch.name = patch.name;
        if (patch.isActive !== undefined) dbPatch.is_active = patch.isActive;

        const after = await departmentsRepository.update(client, auth.tenantId, id, dbPatch);
        await audit({
            actorUserId: auth.userId,
            action: 'DEPARTMENT_UPDATED',
            entity: 'departments',
            entityId: id,
            before,
            after,
        });
        return after;
    },
};