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
      .eq('tenant_id', tenantId).eq('id', id).maybeSingle();
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

  async getVitals(client: SupabaseClient, tenantId: string, encounterId: string) {
    const { data } = await client.from('vitals').select('*')
      .eq('tenant_id', tenantId).eq('encounter_id', encounterId).maybeSingle();
    return data;
  },
  async getDiagnoses(client: SupabaseClient, tenantId: string, encounterId: string) {
    const { data } = await client.from('diagnoses').select('*')
      .eq('tenant_id', tenantId).eq('encounter_id', encounterId).order('created_at');
    return data ?? [];
  },
  async getPrescription(client: SupabaseClient, tenantId: string, encounterId: string) {
    const { data: header } = await client.from('prescriptions').select('*')
      .eq('tenant_id', tenantId).eq('encounter_id', encounterId).maybeSingle();
    if (!header) return null;
    const { data: items } = await client.from('prescription_items').select('*')
      .eq('tenant_id', tenantId).eq('prescription_id', header.id);
    return { ...header, items: items ?? [] };
  },

  async createEncounter(client: SupabaseClient, payload: Record<string, unknown>) {
    const { data, error } = await client.from('encounters').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  },

  /** Atomic save — everything in a single RPC call, one transaction. */
  async saveEncounterAtomic(client: SupabaseClient, p: {
    encounterId: string;
    tenantId: string;
    vitals: unknown;
    diagnoses: unknown;
    prescription: unknown;
    labTests: unknown;
    header: {
      chiefComplaint?: string | null;
      history?: string | null;
      examination?: string | null;
      notes?: string | null;
      complete?: boolean;
    };
  }) {
    const { error } = await client.rpc('save_encounter', {
      p_encounter_id: p.encounterId,
      p_tenant_id:    p.tenantId,
      p_vitals:       p.vitals ?? null,
      p_diagnoses:    p.diagnoses ?? null,
      p_prescription: p.prescription ?? null,
      p_lab_tests:    p.labTests ?? null,
      p_header:       p.header ?? null,
    });
    if (error) throw error;
  },

  async markAppointmentCompleted(client: SupabaseClient, tenantId: string, appointmentId: string) {
    const { error } = await client
      .from('appointments')
      .update({ status: 'COMPLETED' })
      .eq('tenant_id', tenantId)
      .eq('id', appointmentId);
    if (error) throw error;
  },

  async findDefaultBranch(client: SupabaseClient, tenantId: string) {
    const { data } = await client
      .from('branches').select('id').eq('tenant_id', tenantId)
      .eq('is_active', true).order('branch_code').limit(1).maybeSingle();
    return data;
  },

  async updatePrescription(
    client: SupabaseClient,
    tenantId: string,
    encounterId: string,
    prescription: any,
  ) {
    // Delete existing prescription and items
    const { data: existing } = await client
      .from('prescriptions')
      .select('id')
      .eq('encounter_id', encounterId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (existing) {
      await client.from('prescription_items').delete()
        .eq('prescription_id', existing.id)
        .eq('tenant_id', tenantId);
      await client.from('prescriptions').delete()
        .eq('id', existing.id)
        .eq('tenant_id', tenantId);
    }

    // Insert new prescription if provided
    if (prescription && prescription.items && prescription.items.length > 0) {
      const { data: newPresc, error: e1 } = await client
        .from('prescriptions')
        .insert({
          tenant_id: tenantId,
          encounter_id: encounterId,
          notes: prescription.notes ?? null,
        })
        .select('id')
        .single();
      if (e1) throw e1;

      const items = prescription.items.map((it: any) => ({
        tenant_id: tenantId,
        prescription_id: newPresc.id,
        medicine_name: it.medicineName,
        dosage: it.dosage ?? null,
        frequency: it.frequency ?? null,
        duration: it.duration ?? null,
        route: it.route ?? null,
        instructions: it.instructions ?? null,
        quantity: it.quantity ? Number(it.quantity) : null,
      }));

      const { error: e2 } = await client.from('prescription_items').insert(items);
      if (e2) throw e2;
    }
  },
};
