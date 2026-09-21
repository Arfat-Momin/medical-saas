import { supabaseAdmin, supabaseForUser } from '../../config/supabase.js';
import { usersRepository } from './users.repository.js';
import { BadRequest, Conflict, NotFound } from '../../utils/errors.js';
import { audit } from '../../middleware/audit.js';
import { assertWithinPlanLimits } from '../../utils/entitlements.js';
import type { AuthContext } from '@medical/shared';
import type { InviteUserInput, UpdateUserInput, ListUsersQuery } from './users.validators.js';

/**
 * Supabase Auth admin.createUser returns an error when the email
 * already exists. Depending on the SDK version this surfaces as
 * "A user with this email address has already been registered" or
 * a `email_exists` code. Match on either so we handle both.
 */
function isEmailAlreadyRegistered(err: any): boolean {
    if (!err) return false;
    const code  = String(err.code  ?? '').toLowerCase();
    const msg   = String(err.message ?? '').toLowerCase();
    return (
        code === 'email_exists' ||
        code === 'user_already_exists' ||
        msg.includes('already been registered') ||
        msg.includes('already registered') ||
        msg.includes('already exists')
    );
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

    /**
     * Invite a user to the CALLER'S tenant.
     *
     * Two paths:
     *   A) Email is brand new to the platform.
     *      - Create Supabase Auth user with the admin-provided password.
     *      - Insert a `users` profile row.
     *      - attach_user_to_tenant(role, branch).
     *      - Return { existingUser: false }.
     *
     *   B) Email already has a Supabase Auth account (possibly under
     *      another tenant).
     *      - Do NOT create a new auth user or profile.
     *      - Do NOT touch the existing user's password.
     *      - attach_user_to_tenant(role, branch) on the existing id.
     *      - Return { existingUser: true }.
     *
     * Rollback only deletes the auth user when WE created it.
     */
    async invite(auth: AuthContext, token: string, input: InviteUserInput) {
        if (!auth.tenantId) throw NotFound('No tenant context');

        await assertWithinPlanLimits(auth.tenantId, 'users');

        // Resolve role inside this tenant.
        const { data: role, error: roleErr } = await supabaseAdmin
            .from('roles')
            .select('id, code, name')
            .eq('tenant_id', auth.tenantId)
            .eq('code', input.roleCode)
            .maybeSingle();
        if (roleErr) throw roleErr;
        if (!role) throw BadRequest(`Role "${input.roleCode}" not found in this tenant`);

        // Does a platform profile already exist for this email?
        const existingProfile = await usersRepository.findByEmail(supabaseAdmin, input.email);

        // If so, is the user already a member of THIS tenant?
        if (existingProfile) {
            const existingMembership = await usersRepository.findMembership(
                supabaseAdmin,
                auth.tenantId,
                existingProfile.id,
            );
            if (existingMembership && existingMembership.is_active) {
                throw Conflict('This user is already a member of this hospital');
            }
        }

        // ---------- Path A: brand new email ----------
        const { data: authUserData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
            email: input.email,
            password: input.password,
            email_confirm: true,
            user_metadata: { full_name: input.fullName },
        });

        let userId: string;
        let createdNewAuthUser = false;

        if (!authErr && authUserData?.user) {
            userId = authUserData.user.id;
            createdNewAuthUser = true;

            const { error: profileErr } = await supabaseAdmin.from('users').insert({
                id: userId,
                email: input.email,
                full_name: input.fullName,
                phone: input.phone ?? null,
            });
            if (profileErr) {
                await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => { });
                throw profileErr;
            }
        } else if (isEmailAlreadyRegistered(authErr)) {
            // ---------- Path B: existing auth account ----------
            if (!existingProfile) {
                // Auth exists but no public.users profile. Data inconsistency.
                // Refuse so we never orphan a membership.
                throw Conflict(
                    'An account with this email exists but has no profile. Contact platform support.',
                );
            }
            userId = existingProfile.id;
        } else {
            throw BadRequest(authErr?.message ?? 'Failed to create auth user');
        }

        // ---------- Attach to this tenant ----------
        try {
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
                    existingUser: !createdNewAuthUser,
                },
            });

            return {
                userId,
                email: input.email,
                fullName: input.fullName,
                roleCode: role.code,
                branchId: input.branchId ?? null,
                existingUser: !createdNewAuthUser,
            };
        } catch (err) {
            // Roll back only what WE created.
            if (createdNewAuthUser) {
                await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => { });
            }
            throw err;
        }
    },

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