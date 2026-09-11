import type { SupabaseClient } from '@supabase/supabase-js';

export const rolesRepository = {
    async list(client: SupabaseClient, tenantId: string) {
        const { data, error } = await client
            .from('roles')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('code');
        if (error) throw error;
        return data ?? [];
    },

    async findById(client: SupabaseClient, tenantId: string, id: string) {
        const { data, error } = await client
            .from('roles')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('id', id)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    async findByCode(client: SupabaseClient, tenantId: string, code: string) {
        const { data, error } = await client
            .from('roles')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('code', code)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    async updatePermissions(
        client: SupabaseClient,
        tenantId: string,
        id: string,
        permissions: string[],
    ) {
        const { data, error } = await client
            .from('roles')
            .update({ permissions })
            .eq('tenant_id', tenantId)
            .eq('id', id)
            .select('*')
            .single();
        if (error) throw error;
        return data;
    },
};