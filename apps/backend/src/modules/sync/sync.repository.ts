import type { SupabaseClient } from '@supabase/supabase-js';

export const syncRepository = {
  async upsertDevice(
    client: SupabaseClient,
    payload: { tenantId: string; userId: string; deviceId: string; platform: string; appVersion?: string | null; osVersion?: string | null },
  ) {
    const { data, error } = await client
      .from('devices')
      .upsert(
        {
          tenant_id: payload.tenantId,
          user_id: payload.userId,
          device_id: payload.deviceId,
          platform: payload.platform,
          app_version: payload.appVersion ?? null,
          os_version: payload.osVersion ?? null,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,device_id' },
      )
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async listDevicesForUser(client: SupabaseClient, userId: string) {
    const { data, error } = await client.from('devices').select('*').eq('user_id', userId);
    if (error) throw error;
    return data ?? [];
  },

  async pullPatients(client: SupabaseClient, tenantId: string, since: string | null, limit = 500, offset = 0) {
    // No deleted_at filter here on purpose: soft-deleted rows MUST reach the
    // client so it can purge its local Dexie copy. Regular /patients GET still
    // filters, so the UI never shows them.
    let q = client.from('patients').select('*').eq('tenant_id', tenantId)
      .order('updated_at', { ascending: true })
      .range(offset, offset + limit - 1);
    if (since) q = q.gt('updated_at', since);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async pullDoctors(client: SupabaseClient, tenantId: string, _since: string | null) {
    const { data, error } = await client
      .from('memberships')
      .select(`user:user_id ( id, full_name, email, is_active, updated_at ), role:role_id ( code )`)
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    if (error) throw error;
    const rows: any[] = [];
    for (const m of (data ?? []) as any[]) {
      const roleCode = m.role?.code;
      if (roleCode !== 'DOCTOR') continue;
      const u = m.user;
      if (!u || u.is_active === false) continue;
      rows.push({
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        role_code: roleCode,
        updated_at: u.updated_at ?? new Date().toISOString(),
      });
    }
    return rows;
  },

  async pullAppointments(client: SupabaseClient, tenantId: string, since: string | null, limit = 500, offset = 0) {
    // No deleted_at filter here on purpose: soft-deleted rows MUST reach the
    // client so it can purge its local Dexie copy.
    let q = client.from('appointments')
      .select('id, tenant_id, branch_id, patient_id, doctor_id, appointment_date, slot_time, queue_token, status, chief_complaint, notes, created_at, updated_at, deleted_at')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: true })
      .range(offset, offset + limit - 1);
    if (since) q = q.gt('updated_at', since);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async pullMedicines(client: SupabaseClient, tenantId: string, since: string | null, limit = 500, offset = 0) {
    let q = client.from('medicines')
      .select('id, tenant_id, code, barcode, name, generic_name, manufacturer, category, unit, hsn_code, gst_rate, reorder_level, is_active, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: true })
      .range(offset, offset + limit - 1);
    if (since) q = q.gt('updated_at', since);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async pullLabTests(client: SupabaseClient, tenantId: string, since: string | null, limit = 500, offset = 0) {
    let q = client.from('lab_tests')
      .select('id, tenant_id, code, name, category, sample_type, unit, reference_min, reference_max, reference_text, price, turnaround_hrs, is_active, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: true })
      .range(offset, offset + limit - 1);
    if (since) q = q.gt('updated_at', since);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async pullOrganization(client: SupabaseClient, tenantId: string) {
    const { data, error } = await client
      .from('organizations')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) throw error;
    return data ? [data] : [];
  },

  async pullBranches(client: SupabaseClient, tenantId: string) {
    const { data, error } = await client
      .from('branches')
      .select('id, tenant_id, organization_id, name, address, city, state, pincode, phone, branch_code, is_active, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .order('branch_code');
    if (error) throw error;
    return data ?? [];
  },

  async pullEncounters(client: SupabaseClient, tenantId: string, since: string | null, limit = 500, offset = 0) {
    // Pull only the encounter header. Child tables (vitals, diagnoses,
    // prescriptions) are fetched on demand when a user opens a specific
    // encounter while online. This keeps the header visible offline.
    let q = client.from('encounters')
      .select('id, tenant_id, branch_id, patient_id, doctor_id, appointment_id, encounter_type, encounter_date, status, chief_complaint, history, examination, notes, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: true })
      .range(offset, offset + limit - 1);
    if (since) q = q.gt('updated_at', since);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },
};