import type { SupabaseClient } from '@supabase/supabase-js';

export const opdRepository = {
  async findById(client: SupabaseClient, tenantId: string, id: string) {
    const { data, error } = await client
      .from('encounters')
      .select(`
        *,
        patients:patient_id ( id, uhid, full_name, mobile, date_of_birth, gender, blood_group, allergies, medical_history ),
        doctors:doctor_id  ( id, full_name, email ),
        branches:branch_id ( id, name, branch_code ),
        appointments:appointment_id ( id, queue_token, status )
      `)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async list(client: SupabaseClient, tenantId: string, opts: { patientId?: string; doctorId?: string; date?: string; page: number; pageSize: number }) {
    const from = (opts.page - 1) * opts.pageSize;
    const to = from + opts.pageSize - 1;

    let q = client
      .from('encounters')
      .select(`
        id, tenant_id, patient_id, doctor_id, appointment_id,
        encounter_type, encounter_date, status, chief_complaint,
        created_at, updated_at,
        patients:patient_id ( id, uhid, full_name ),
        doctors:doctor_id  ( id, full_name )
      `, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('encounter_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (opts.patientId) q = q.eq('patient_id', opts.patientId);
    if (opts.doctorId)  q = q.eq('doctor_id', opts.doctorId);
    if (opts.date)      q = q.eq('encounter_date', opts.date);

    const { data, error, count } = await q.range(from, to);
    if (error) throw error;
    return { rows: data ?? [], total: count ?? 0, page: opts.page, pageSize: opts.pageSize };
  },

  async getVitals(client: SupabaseClient, encounterId: string) {
    const { data } = await client.from('vitals').select('*').eq('encounter_id', encounterId).maybeSingle();
    return data;
  },

  async getDiagnoses(client: SupabaseClient, encounterId: string) {
    const { data } = await client.from('diagnoses').select('*').eq('encounter_id', encounterId).order('created_at');
    return data ?? [];
  },

  async getPrescription(client: SupabaseClient, encounterId: string) {
    const { data: header } = await client.from('prescriptions').select('*').eq('encounter_id', encounterId).maybeSingle();
    if (!header) return null;
    const { data: items } = await client.from('prescription_items').select('*').eq('prescription_id', header.id);
    return { ...header, items: items ?? [] };
  },

  async createEncounter(client: SupabaseClient, payload: Record<string, unknown>) {
    const { data, error } = await client.from('encounters').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  },

  async updateEncounter(client: SupabaseClient, tenantId: string, id: string, patch: Record<string, unknown>) {
    const { data, error } = await client
      .from('encounters').update(patch).eq('tenant_id', tenantId).eq('id', id)
      .select('*').single();
    if (error) throw error;
    return data;
  },

  async saveEncounterBundle(client: SupabaseClient, p: {
    encounterId: string; tenantId: string;
    vitals: any; diagnoses: any; prescription: any;
  }) {
    const { error } = await client.rpc('save_encounter', {
      p_encounter_id: p.encounterId,
      p_tenant_id:    p.tenantId,
      p_vitals:       p.vitals ?? null,
      p_diagnoses:    p.diagnoses ?? null,
      p_prescription: p.prescription ?? null,
    });
    if (error) throw error;
  },

  async findDefaultBranch(client: SupabaseClient, tenantId: string) {
    const { data } = await client
      .from('branches').select('id').eq('tenant_id', tenantId)
      .eq('is_active', true).order('branch_code').limit(1).maybeSingle();
    return data;
  },
};