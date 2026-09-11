import type { SupabaseClient } from '@supabase/supabase-js';

export const departmentsRepository = {
    async list(client: SupabaseClient, tenantId: string, branchId: string | undefined, activeOnly: boolean) {
        let q = client
            .from('departments')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('name');
        if (branchId) q = q.eq('branch_id', branchId);
        if (activeOnly) q = q.eq('is_active', true);
        const { data, error } = await q;
        if (error) throw error;
        return data ?? [];
    },

    async findById(client: SupabaseClient, tenantId: string, id: string) {
        const { data, error } = await client
            .from('departments')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('id', id)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    async create(client: SupabaseClient, payload: Record<string, unknown>) {
        const { data, error } = await client.from('departments').insert(payload).select('*').single();
        if (error) throw error;
        return data;
    },

    async update(client: SupabaseClient, tenantId: string, id: string, patch: Record<string, unknown>) {
        const { data, error } = await client
            .from('departments')
            .update(patch)
            .eq('tenant_id', tenantId)
            .eq('id', id)
            .select('*')
            .single();
        if (error) throw error;
        return data;
    },
};