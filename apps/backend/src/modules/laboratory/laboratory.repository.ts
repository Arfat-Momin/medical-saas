import type { SupabaseClient } from '@supabase/supabase-js';

const ORDER_SELECT = `
  id, tenant_id, branch_id, patient_id, doctor_id, encounter_id,
  order_date, status, priority, notes, total_amount,
  created_at, updated_at,
  patients:patient_id ( id, uhid, full_name, mobile, date_of_birth, gender ),
  doctors:doctor_id  ( id, full_name ),
  branches:branch_id ( id, name, branch_code )
`;

const ITEM_SELECT = `
  id, tenant_id, order_id, test_id, test_code, test_name, sample_type,
  price, result_value, result_unit, reference_text, flag,
  resulted_by, resulted_at, verified_by, verified_at, remarks,
  created_at, updated_at
`;

export const laboratoryRepository = {
  // ---- TESTS ----
  async listTests(client: SupabaseClient, tenantId: string, opts: { search?: string; page: number; pageSize: number; activeOnly: boolean }) {
    const from = (opts.page - 1) * opts.pageSize;
    const to = from + opts.pageSize - 1;
    let q = client.from('lab_tests').select('*', { count: 'exact' }).eq('tenant_id', tenantId).order('name');
    if (opts.activeOnly) q = q.eq('is_active', true);
    if (opts.search) {
      const s = opts.search.replace(/[,%]/g, '');
      q = q.or(`name.ilike.%${s}%,code.ilike.%${s}%,category.ilike.%${s}%`);
    }
    const { data, error, count } = await q.range(from, to);
    if (error) throw error;
    return { rows: data ?? [], total: count ?? 0, page: opts.page, pageSize: opts.pageSize };
  },
  async createTest(client: SupabaseClient, payload: Record<string, unknown>) {
    const { data, error } = await client.from('lab_tests').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  },
  async findTest(client: SupabaseClient, tenantId: string, id: string) {
    const { data, error } = await client.from('lab_tests').select('*').eq('tenant_id', tenantId).eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },
  async updateTest(client: SupabaseClient, tenantId: string, id: string, patch: Record<string, unknown>) {
    const { data, error } = await client.from('lab_tests').update(patch).eq('tenant_id', tenantId).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },

  // ---- ORDERS ----
  async listOrders(client: SupabaseClient, tenantId: string, opts: { status?: string; patientId?: string; date?: string; page: number; pageSize: number }) {
    const from = (opts.page - 1) * opts.pageSize;
    const to = from + opts.pageSize - 1;
    let q = client.from('lab_orders').select(ORDER_SELECT, { count: 'exact' }).eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (opts.status) q = q.eq('status', opts.status);
    if (opts.patientId) q = q.eq('patient_id', opts.patientId);
    if (opts.date) q = q.eq('order_date', opts.date);
    const { data, error, count } = await q.range(from, to);
    if (error) throw error;
    return { rows: data ?? [], total: count ?? 0, page: opts.page, pageSize: opts.pageSize };
  },

  async findOrderWithItems(client: SupabaseClient, tenantId: string, id: string) {
    const { data: order, error: oErr } = await client
      .from('lab_orders').select(ORDER_SELECT).eq('tenant_id', tenantId).eq('id', id).maybeSingle();
    if (oErr) throw oErr;
    if (!order) return null;

    const { data: items, error: iErr } = await client
      .from('lab_order_items').select(ITEM_SELECT)
      .eq('tenant_id', tenantId).eq('order_id', id).order('created_at');
    if (iErr) throw iErr;

    const { data: samples } = await client
      .from('lab_samples').select('*')
      .eq('tenant_id', tenantId).eq('order_id', id).order('collected_at');

    return { ...order, items: items ?? [], samples: samples ?? [] };
  },

  async createOrder(client: SupabaseClient, p: { tenantId: string; userId: string; branchId: string; patientId: string; doctorId: string; encounterId?: string | null; priority: string; notes?: string | null; testIds: string[] }) {
    const { data, error } = await client.rpc('create_lab_order', {
      p_tenant_id:    p.tenantId,
      p_branch_id:    p.branchId,
      p_patient_id:   p.patientId,
      p_doctor_id:    p.doctorId,
      p_encounter_id: p.encounterId ?? null,
      p_priority:     p.priority,
      p_notes:        p.notes ?? null,
      p_test_ids:     p.testIds,
      p_user_id:      p.userId,
    });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    return result as { orderId: string; totalAmount: number };
  },

  async updateOrderStatus(client: SupabaseClient, tenantId: string, id: string, status: string) {
    const { data, error } = await client.from('lab_orders').update({ status }).eq('tenant_id', tenantId).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },

  async collectSample(client: SupabaseClient, p: { tenantId: string; userId: string; orderId: string; sampleType: string; barcode?: string | null; notes?: string | null }) {
    const { data, error } = await client.from('lab_samples').insert({
      tenant_id: p.tenantId,
      order_id: p.orderId,
      sample_type: p.sampleType,
      barcode: p.barcode ?? null,
      collected_by: p.userId,
      notes: p.notes ?? null,
    }).select('*').single();
    if (error) throw error;
    return data;
  },

  async enterResults(client: SupabaseClient, tenantId: string, userId: string, items: { itemId: string; resultValue?: string | null; resultUnit?: string | null; flag?: string | null; remarks?: string | null }[]) {
    for (const it of items) {
      const patch: Record<string, unknown> = {
        result_value: it.resultValue ?? null,
        resulted_by: userId,
        resulted_at: new Date().toISOString(),
      };
      if (it.resultUnit !== undefined) patch.result_unit = it.resultUnit;
      if (it.flag !== undefined)       patch.flag = it.flag;
      if (it.remarks !== undefined)    patch.remarks = it.remarks;

      const { error } = await client.from('lab_order_items')
        .update(patch)
        .eq('tenant_id', tenantId)
        .eq('id', it.itemId);
      if (error) throw error;
    }
  },

  async verifyResults(client: SupabaseClient, tenantId: string, userId: string, orderId: string) {
    const { error } = await client.from('lab_order_items')
      .update({ verified_by: userId, verified_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('order_id', orderId)
      .not('resulted_at', 'is', null);
    if (error) throw error;
  },

  async findDefaultBranch(client: SupabaseClient, tenantId: string) {
    const { data, error } = await client.from('branches').select('id').eq('tenant_id', tenantId)
      .eq('is_active', true).order('branch_code').limit(1).maybeSingle();
    if (error) throw error;
    return data;
  },
};