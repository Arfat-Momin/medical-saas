import type { SupabaseClient } from '@supabase/supabase-js';

const ADMISSION_SELECT = `
  id, tenant_id, branch_id, patient_id, bed_id, admitting_doctor,
  admitted_at, expected_discharge, discharged_at, status,
  reason, diagnosis, notes, discharge_summary, discharge_type,
  created_at, updated_at,
  patients:patient_id ( id, uhid, full_name, mobile, date_of_birth, gender ),
  doctors:admitting_doctor ( id, full_name ),
  branches:branch_id ( id, name, branch_code )
`;

export const ipdRepository = {
  // ---- Locations ----
  async listLocations(client: SupabaseClient, tenantId: string, opts: { branchId?: string; parentId?: string; type?: string }) {
    let q = client.from('locations').select('*').eq('tenant_id', tenantId).order('type').order('name');
    if (opts.branchId) q = q.eq('branch_id', opts.branchId);
    if (opts.parentId) q = q.eq('parent_id', opts.parentId);
    if (opts.type)     q = q.eq('type', opts.type);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },
  async findLocation(client: SupabaseClient, tenantId: string, id: string) {
    const { data, error } = await client.from('locations').select('*').eq('tenant_id', tenantId).eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },
  async createLocation(client: SupabaseClient, payload: Record<string, unknown>) {
    const { data, error } = await client.from('locations').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  },
  async updateLocation(client: SupabaseClient, tenantId: string, id: string, patch: Record<string, unknown>) {
    const { data, error } = await client.from('locations').update(patch).eq('tenant_id', tenantId).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async deleteLocation(client: SupabaseClient, tenantId: string, id: string) {
    const { error } = await client.from('locations').delete().eq('tenant_id', tenantId).eq('id', id);
    if (error) throw error;
  },
  async countChildren(client: SupabaseClient, tenantId: string, id: string) {
    const { count, error } = await client.from('locations').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('parent_id', id);
    if (error) throw error;
    return count ?? 0;
  },
  async countAdmissionsForBed(client: SupabaseClient, tenantId: string, bedId: string) {
    const { count, error } = await client.from('admissions').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('bed_id', bedId);
    if (error) throw error;
    return count ?? 0;
  },

  // ---- Beds (with derived status) ----
  async listBeds(client: SupabaseClient, tenantId: string, branchId?: string) {
    let q = client.from('v_beds_with_status').select('*').eq('tenant_id', tenantId);
    if (branchId) q = q.eq('branch_id', branchId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  // ---- Admissions ----
  async listAdmissions(client: SupabaseClient, tenantId: string, opts: { status?: string; patientId?: string; page: number; pageSize: number }) {
    const from = (opts.page - 1) * opts.pageSize;
    const to = from + opts.pageSize - 1;
    let q = client.from('admissions').select(ADMISSION_SELECT, { count: 'exact' })
      .eq('tenant_id', tenantId).order('admitted_at', { ascending: false });
    if (opts.status)    q = q.eq('status', opts.status);
    if (opts.patientId) q = q.eq('patient_id', opts.patientId);
    const { data, error, count } = await q.range(from, to);
    if (error) throw error;
    return { rows: data ?? [], total: count ?? 0, page: opts.page, pageSize: opts.pageSize };
  },
  async findAdmissionFull(client: SupabaseClient, tenantId: string, id: string) {
    const { data: adm, error: e1 } = await client.from('admissions').select(ADMISSION_SELECT)
      .eq('tenant_id', tenantId).eq('id', id).maybeSingle();
    if (e1) throw e1;
    if (!adm) return null;

    const { data: bed } = await client.from('locations').select('*').eq('id', adm.bed_id).maybeSingle();

    const { data: transfers } = await client.from('bed_transfers').select('*, from_bed:from_bed_id(name), to_bed:to_bed_id(name), by:transferred_by(full_name)')
      .eq('admission_id', id).order('transferred_at', { ascending: false });

    const { data: notes } = await client.from('nursing_notes').select('*, by:recorded_by(full_name)')
      .eq('admission_id', id).order('recorded_at', { ascending: false });

    const { data: rounds } = await client.from('doctor_rounds').select('*, doctor:doctor_id(full_name)')
      .eq('admission_id', id).order('round_at', { ascending: false });

    const { data: mar } = await client.from('mar_records').select('*, by:administered_by(full_name)')
      .eq('admission_id', id).order('scheduled_at', { ascending: true });

    return { ...adm, bed, transfers: transfers ?? [], nursing_notes: notes ?? [], rounds: rounds ?? [], mar: mar ?? [] };
  },
  async admit(client: SupabaseClient, p: { tenantId: string; userId: string; branchId: string; patientId: string; bedId: string; admittingDoctor: string; reason?: string | null; diagnosis?: string | null; expectedDischarge?: string | null }) {
    const { data, error } = await client.rpc('admit_patient', {
      p_tenant_id: p.tenantId,
      p_branch_id: p.branchId,
      p_patient_id: p.patientId,
      p_bed_id: p.bedId,
      p_doctor_id: p.admittingDoctor,
      p_reason: p.reason ?? null,
      p_diagnosis: p.diagnosis ?? null,
      p_expected_discharge: p.expectedDischarge ?? null,
      p_user_id: p.userId,
    });
    if (error) throw error;
    return (Array.isArray(data) ? data[0] : data) as { admissionId: string };
  },
  async transfer(client: SupabaseClient, p: { tenantId: string; userId: string; admissionId: string; toBedId: string; reason: string }) {
    const { error } = await client.rpc('transfer_bed', {
      p_tenant_id: p.tenantId,
      p_admission_id: p.admissionId,
      p_to_bed_id: p.toBedId,
      p_reason: p.reason,
      p_user_id: p.userId,
    });
    if (error) throw error;
  },
  async discharge(client: SupabaseClient, p: { tenantId: string; userId: string; admissionId: string; dischargeType: string; dischargeSummary?: string | null }) {
    const { error } = await client.rpc('discharge_patient', {
      p_tenant_id: p.tenantId,
      p_admission_id: p.admissionId,
      p_discharge_type: p.dischargeType,
      p_discharge_summary: p.dischargeSummary ?? null,
      p_user_id: p.userId,
    });
    if (error) throw error;
  },

  // ---- Nursing notes ----
  async createNursingNote(client: SupabaseClient, payload: Record<string, unknown>) {
    const { data, error } = await client.from('nursing_notes').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  },

  // ---- Doctor rounds ----
  async createDoctorRound(client: SupabaseClient, payload: Record<string, unknown>) {
    const { data, error } = await client.from('doctor_rounds').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  },

  // ---- MAR ----
  async createMar(client: SupabaseClient, payload: Record<string, unknown>) {
    const { data, error } = await client.from('mar_records').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  },
  async markMar(client: SupabaseClient, tenantId: string, id: string, patch: Record<string, unknown>) {
    const { data, error } = await client.from('mar_records').update(patch).eq('tenant_id', tenantId).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async findMar(client: SupabaseClient, tenantId: string, id: string) {
    const { data } = await client.from('mar_records').select('*').eq('tenant_id', tenantId).eq('id', id).maybeSingle();
    return data;
  },

  async findDefaultBranch(client: SupabaseClient, tenantId: string) {
    const { data, error } = await client.from('branches').select('id')
      .eq('tenant_id', tenantId).eq('is_active', true)
      .order('branch_code').limit(1).maybeSingle();
    if (error) throw error;
    return data;
  },
};