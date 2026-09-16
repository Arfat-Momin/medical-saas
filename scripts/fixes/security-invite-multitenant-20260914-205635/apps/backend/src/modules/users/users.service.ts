import { randomBytes } from 'node:crypto';
import { supabaseAdmin, supabaseForUser } from '../../config/supabase.js';
import { usersRepository } from './users.repository.js';
import { BadRequest, Conflict, NotFound } from '../../utils/errors.js';
import { audit } from '../../middleware/audit.js';
import { assertWithinPlanLimits } from '../../utils/entitlements.js';
import type { AuthContext } from '@medical/shared';
import type { InviteUserInput, UpdateUserInput, ListUsersQuery } from './users.validators.js';

function generateTempPassword(): string {
    return randomBytes(10).toString('base64url').slice(0, 12) + 'aA1!';
}

export const usersService = {
    async list(auth: AuthContext, token: string, query: ListUsersQuery) {
        if (!auth.tenantId) throw NotFound('No tenant context');
        const client = supabaseForUser(token);
        return usersRepository.list(client, auth.tenantId, query);
    },

    async getById(auth: AuthContext, token: string, userId: string) {
        if (!auth.tenantId) throw NotFound('No tenant context');
        const client = supabaseForUser(token);
        const profile = await usersRepository.findProfileById(client, userId);
        if (!profile) throw NotFound('User not found');
        const memberships = await usersRepository.listMembershipsForUser(client, auth.tenantId, userId);
        if (memberships.length === 0) throw NotFound('User is not part of this tenant');
        return { profile, memberships };
    },

    async invite(auth: AuthContext, token: string, input: InviteUserInput) {
        if (!auth.tenantId) throw NotFound('No tenant context');

        await assertWithinPlanLimits(auth.tenantId, 'users');

        const { data: role, error: roleErr } = await supabaseAdmin
            .from('roles')
            .select('id, code, name')
            .eq('tenant_id', auth.tenantId)
            .eq('code', input.roleCode)
            .maybeSingle();
        if (roleErr) throw roleErr;
        if (!role) throw BadRequest(`Role "${input.roleCode}" not found in this tenant`);

        const existing = await usersRepository.findByEmail(supabaseAdmin, input.email);
        if (existing) throw Conflict('A user with this email already exists');

        const tempPassword = generateTempPassword();
        const { data: authUserData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
            email: input.email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: input.fullName },
        });
        if (authErr || !authUserData.user) {
            throw BadRequest(authErr?.message ?? 'Failed to create auth user');
        }
        const userId = authUserData.user.id;

        try {
            const { error: profileErr } = await supabaseAdmin.from('users').insert({
                id: userId,
                email: input.email,
                full_name: input.fullName,
                phone: input.phone ?? null,
            });
            if (profileErr) throw profileErr;

            const { error: attachErr } = await supabaseAdmin.rpc('attach_user_to_tenant', {
                p_user_id: userId,
                p_tenant_id: auth.tenantId,
                p_role_id: role.id,
                p_branch_id: input.branchId ?? null,
            });
            if (attachErr) throw attachErr;

            await audit({
                actorUserId: auth.userId,
                action: 'USER_INVITED',
                entity: 'users',
                entityId: userId,
                after: {
                    email: input.email,
                    fullName: input.fullName,
                    roleCode: role.code,
                    branchId: input.branchId ?? null,
                },
            });

            return {
                userId,
                email: input.email,
                fullName: input.fullName,
                roleCode: role.code,
                branchId: input.branchId ?? null,
                tempPassword,
            };
        } catch (err) {
            await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => { });
            throw err;
        }
    },

    /**
     * Update a user from the perspective of the CALLER'S tenant.
     *
     * SECURITY FIX (cross-tenant is_active side effect):
     *   - `isActive` used to write to the GLOBAL `users.is_active`
     *     column. A Hospital Admin in Tenant A could thereby lock the
     *     same human out of Tenant B. That is a cross-tenant
     *     denial-of-service and violates tenant isolation.
     *   - `isActive` now writes ONLY to `memberships.is_active` for
     *     the caller's tenant.
     *   - `users.is_active` remains a platform-admin-only control;
     *     this endpoint never touches it.
     */
    async update(auth: AuthContext, token: string, userId: string, patch: UpdateUserInput) {
        if (!auth.tenantId) throw NotFound('No tenant context');

        const membership = await usersRepository.findMembership(supabaseAdmin, auth.tenantId, userId);
        if (!membership) throw NotFound('User is not part of this tenant');

        const profilePatch: Record<string, unknown> = {};
        if (patch.fullName !== undefined)         profilePatch.full_name = patch.fullName;
        if (patch.phone !== undefined)            profilePatch.phone = patch.phone;
        if (patch.consultationFee !== undefined)  profilePatch.consultation_fee = patch.consultationFee;

        const hasMembershipChange = patch.isActive !== undefined;
        const nextMembershipActive: boolean = hasMembershipChange
            ? (patch.isActive as boolean)
            : (membership.is_active as boolean);

        if (Object.keys(profilePatch).length === 0 && !hasMembershipChange) {
            return { message: 'Nothing to update' };
        }

        const before = await usersRepository.findProfileById(supabaseAdmin, userId);

        // Snapshot the resulting global-profile values without
        // reassigning `after` to a narrower type.
        let afterProfile: Record<string, unknown> | null = null;
        if (Object.keys(profilePatch).length > 0) {
            afterProfile = await usersRepository.updateProfile(supabaseAdmin, userId, profilePatch);
        }

        if (hasMembershipChange) {
            await usersRepository.setMembershipActive(
                supabaseAdmin,
                auth.tenantId,
                userId,
                patch.isActive as boolean,
            );
        }

        await audit({
            actorUserId: auth.userId,
            action: 'USER_UPDATED',
            entity: 'users',
            entityId: userId,
            before: {
                full_name: before?.full_name ?? null,
                phone: before?.phone ?? null,
                consultation_fee: before?.consultation_fee ?? null,
                membership_active: membership.is_active,
            },
            after: {
                full_name: afterProfile?.full_name ?? before?.full_name ?? null,
                phone: afterProfile?.phone ?? before?.phone ?? null,
                consultation_fee: afterProfile?.consultation_fee ?? before?.consultation_fee ?? null,
                membership_active: nextMembershipActive,
            },
        });

        const base = afterProfile ?? before ?? {};
        return {
            ...base,
            membership_active: nextMembershipActive,
        };
    },
};