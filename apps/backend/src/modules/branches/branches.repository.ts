import type { SupabaseClient } from '@supabase/supabase-js';

export const branchesRepository = {
    async list(client: SupabaseClient, tenantId: string, activeOnly: boolean) {
        let q = client.from('branches').select('*').eq('tenant_id', tenantId).order('branch_code');
        if (activeOnly) q = q.eq('is_active', true);
        const { data, error } = await q;
        if (error) throw error;
        return data ?? [];
    },

    async findById(client: SupabaseClient, tenantId: string, id: string) {
        const { data, error } = await client
            .from('branches')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('id', id)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    async create(client: SupabaseClient, payload: Record<string, unknown>) {
        const { data, error } = await client.from('branches').insert(payload).select('*').single();
        if (error) throw error;
        return data;
    },

    async update(client: SupabaseClient, tenantId: string, id: string, patch: Record<string, unknown>) {
        const { data, error } = await client
            .from('branches')
            .update(patch)
            .eq('tenant_id', tenantId)
            .eq('id', id)
            .select('*')
            .single();
        if (error) throw error;
        return data;
    },

    async findOrganization(client: SupabaseClient, tenantId: string) {
        const { data, error } = await client
            .from('organizations')
            .select('id')
            .eq('tenant_id', tenantId)
            .maybeSingle();
        if (error) throw error;
        return data;
    },
};