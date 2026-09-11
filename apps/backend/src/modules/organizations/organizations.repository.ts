import type { SupabaseClient } from '@supabase/supabase-js';

export const organizationsRepository = {
    async findByTenantId(client: SupabaseClient, tenantId: string) {
        const { data, error } = await client
            .from('organizations')
            .select('*')
            .eq('tenant_id', tenantId)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    async update(client: SupabaseClient, id: string, patch: Record<string, unknown>) {
        const { data, error } = await client
            .from('organizations')
            .update(patch)
            .eq('id', id)
            .select('*')
            .single();
        if (error) throw error;
        return data;
    },
};