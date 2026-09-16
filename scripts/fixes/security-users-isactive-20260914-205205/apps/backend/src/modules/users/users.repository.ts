import type { SupabaseClient } from '@supabase/supabase-js';

export const usersRepository = {
    async list(
        client: SupabaseClient,
        tenantId: string,
        opts: { page: number; pageSize: number; branchId?: string; roleCode?: string; search?: string },
    ) {
        const from = (opts.page - 1) * opts.pageSize;
        const to = from + opts.pageSize - 1;

        let q = client
            .from('memberships')
            .select(
                `id, tenant_id, user_id, role_id, branch_id, is_active,
         users:user_id ( id, email, full_name, phone, is_active, consultation_fee ),
         roles:role_id ( id, code, name ),
         branches:branch_id ( id, name, branch_code )`,
                { count: 'exact' },
            )
            .eq('tenant_id', tenantId)
            .eq('is_active', true);

        if (opts.branchId) q = q.eq('branch_id', opts.branchId);

        const { data, error, count } = await q.range(from, to);
        if (error) throw error;

        let rows = data ?? [];

        if (opts.roleCode) {
            rows = rows.filter((r: any) => r.roles?.code === opts.roleCode);
        }
        if (opts.search) {
            const s = opts.search.toLowerCase();
            rows = rows.filter(
                (r: any) =>
                    r.users?.full_name?.toLowerCase().includes(s) ||
                    r.users?.email?.toLowerCase().includes(s),
            );
        }

        return { rows, total: count ?? rows.length, page: opts.page, pageSize: opts.pageSize };
    },

    async findByEmail(client: SupabaseClient, email: string) {
        const { data, error } = await client
            .from('users')
            .select('id, email, full_name')
            .eq('email', email)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    async findProfileById(client: SupabaseClient, id: string) {
        const { data, error } = await client
            .from('users')
            .select('id, email, full_name, phone, is_platform_admin, is_active, created_at, updated_at, consultation_fee')
            .eq('id', id)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    async listMembershipsForUser(client: SupabaseClient, tenantId: string, userId: string) {
        const { data, error } = await client
            .from('memberships')
            .select(
                `id, tenant_id, user_id, role_id, branch_id, is_active,
         roles:role_id ( id, code, name ),
         branches:branch_id ( id, name, branch_code )`,
            )
            .eq('tenant_id', tenantId)
            .eq('user_id', userId);
        if (error) throw error;
        return data ?? [];
    },

    async updateProfile(client: SupabaseClient, id: string, patch: Record<string, unknown>) {
        const { data, error } = await client
            .from('users')
            .update(patch)
            .eq('id', id)
            .select('id, email, full_name, phone, is_active, consultation_fee')
            .single();
        if (error) throw error;
        return data;
    },

    /**
     * Toggle a user's membership in a SPECIFIC tenant.
     *
     * SECURITY: this is the correct way to "disable a user". It only
     * affects `memberships.is_active` for the given tenant, so an
     * admin in Tenant A cannot lock the same human out of Tenant B.
     */
    async setMembershipActive(
        client: SupabaseClient,
        tenantId: string,
        userId: string,
        isActive: boolean,
    ) {
        const { data, error } = await client
            .from('memberships')
            .update({ is_active: isActive })
            .eq('tenant_id', tenantId)
            .eq('user_id', userId)
            .select('id, tenant_id, user_id, is_active')
            .single();
        if (error) throw error;
        return data;
    },

    /**
     * Fetch a single membership row for a user in a tenant.
     * Used to (a) verify the user is part of this tenant, and (b)
     * snapshot the previous membership state for the audit log.
     */
    async findMembership(client: SupabaseClient, tenantId: string, userId: string) {
        const { data, error } = await client
            .from('memberships')
            .select('id, is_active')
            .eq('tenant_id', tenantId)
            .eq('user_id', userId)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    /**
     * @deprecated Kept for backwards compatibility. Use
     * `setMembershipActive(client, tenantId, userId, false)` instead.
     */
    async deactivateMemberships(client: SupabaseClient, tenantId: string, userId: string) {
        const { error } = await client
            .from('memberships')
            .update({ is_active: false })
            .eq('tenant_id', tenantId)
            .eq('user_id', userId);
        if (error) throw error;
    },
};