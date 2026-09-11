import type { SupabaseClient } from '@supabase/supabase-js';

const SELECT = `
  id, tenant_id, branch_id, patient_id, doctor_id,
  appointment_date, slot_time, queue_token, status,
  chief_complaint, notes, created_at, updated_at,
  patients:patient_id ( id, uhid, full_name, mobile, date_of_birth, gender ),
  doctors:doctor_id  ( id, full_name, email ),
  branches:branch_id ( id, name, branch_code )
`;

export const appointmentsRepository = {
  async list(
    client: SupabaseClient,
    tenantId: string,
    opts: {
      date?: string; doctorId?: string; patientId?: string; status?: string;
      page: number; pageSize: number;
    },
  ) {
    const from = (opts.page - 1) * opts.pageSize;
    const to = from + opts.pageSize - 1;

    let q = client
      .from('appointments')
      .select(SELECT, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('appointment_date', { ascending: false })
      .order('queue_token', { ascending: true, nullsFirst: false });

    if (opts.date)      q = q.eq('appointment_date', opts.date);
    if (opts.doctorId)  q = q.eq('doctor_id', opts.doctorId);
    if (opts.patientId) q = q.eq('patient_id', opts.patientId);
    if (opts.status)    q = q.eq('status', opts.status);

    const { data, error, count } = await q.range(from, to);
    if (error) throw error;
    return { rows: data ?? [], total: count ?? 0, page: opts.page, pageSize: opts.pageSize };
  },

  async findById(client: SupabaseClient, tenantId: string, id: string) {
    const { data, error } = await client
      .from('appointments')
      .select(SELECT)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(client: SupabaseClient, payload: Record<string, unknown>) {
    const { data, error } = await client
      .from('appointments')
      .insert(payload)
      .select(SELECT)
      .single();
    if (error) throw error;
    return data;
  },

  async update(client: SupabaseClient, tenantId: string, id: string, patch: Record<string, unknown>) {
    const { data, error } = await client
      .from('appointments')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select(SELECT)
      .single();
    if (error) throw error;
    return data;
  },

  async nextQueueToken(client: SupabaseClient, tenantId: string, branchId: string, doctorId: string, date: string) {
    const { data, error } = await client.rpc('next_queue_token', {
      p_tenant: tenantId, p_branch: branchId, p_doctor: doctorId, p_date: date,
    });
    if (error) throw error;
    return data as number;
  },

  async findDefaultBranch(client: SupabaseClient, tenantId: string) {
    const { data, error } = await client
      .from('branches').select('id').eq('tenant_id', tenantId)
      .eq('is_active', true).order('branch_code').limit(1).maybeSingle();
    if (error) throw error;
    return data;
  },
};