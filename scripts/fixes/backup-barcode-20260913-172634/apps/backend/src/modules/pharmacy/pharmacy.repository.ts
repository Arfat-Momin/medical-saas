import type { SupabaseClient } from '@supabase/supabase-js';

export const pharmacyRepository = {
  // ---------------- MEDICINES ----------------
  async listMedicines(client: SupabaseClient, tenantId: string, opts: { search?: string; page: number; pageSize: number; activeOnly: boolean }) {
    const from = (opts.page - 1) * opts.pageSize;
    const to = from + opts.pageSize - 1;
    let q = client
      .from('medicines')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('name');
    if (opts.activeOnly) q = q.eq('is_active', true);
    if (opts.search) {
      const s = opts.search.replace(/[,%]/g, '');
      q = q.or(`name.ilike.%${s}%,generic_name.ilike.%${s}%,code.ilike.%${s}%`);
    }
    const { data, error, count } = await q.range(from, to);
    if (error) throw error;
    return { rows: data ?? [], total: count ?? 0, page: opts.page, pageSize: opts.pageSize };
  },

  async createMedicine(client: SupabaseClient, payload: Record<string, unknown>) {
    const { data, error } = await client.from('medicines').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  },

  async findMedicine(client: SupabaseClient, tenantId: string, id: string) {
    const { data, error } = await client.from('medicines').select('*').eq('tenant_id', tenantId).eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async updateMedicine(client: SupabaseClient, tenantId: string, id: string, patch: Record<string, unknown>) {
    const { data, error } = await client.from('medicines').update(patch).eq('tenant_id', tenantId).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },

  // ---------------- SUPPLIERS ----------------
  async listSuppliers(client: SupabaseClient, tenantId: string, activeOnly = true) {
    let q = client.from('suppliers').select('*').eq('tenant_id', tenantId).order('name');
    if (activeOnly) q = q.eq('is_active', true);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async createSupplier(client: SupabaseClient, payload: Record<string, unknown>) {
    const { data, error } = await client.from('suppliers').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  },

  async findSupplier(client: SupabaseClient, tenantId: string, id: string) {
    const { data, error } = await client.from('suppliers').select('*').eq('tenant_id', tenantId).eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async updateSupplier(client: SupabaseClient, tenantId: string, id: string, patch: Record<string, unknown>) {
    const { data, error } = await client.from('suppliers').update(patch).eq('tenant_id', tenantId).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },

  // ---------------- BATCHES ----------------
  async listBatches(client: SupabaseClient, tenantId: string, medicineId?: string, onlyInStock = false) {
    let q = client
      .from('medicine_batches')
      .select(`
        *,
        medicines:medicine_id ( id, name, unit )
      `)
      .eq('tenant_id', tenantId)
      .order('expiry_date');
    if (medicineId) q = q.eq('medicine_id', medicineId);
    if (onlyInStock) q = q.gt('current_qty', 0);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  // ---------------- PURCHASES ----------------
  async listPurchases(client: SupabaseClient, tenantId: string, page: number, pageSize: number) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await client
      .from('purchases')
      .select(`
        *,
        suppliers:supplier_id ( id, name )
      `, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    return { rows: data ?? [], total: count ?? 0, page, pageSize };
  },

  async receivePurchase(client: SupabaseClient, p: { tenantId: string; userId: string; supplierId: string; invoiceNo?: string | null; purchaseDate?: string; notes?: string | null; items: any[] }) {
    const { data, error } = await client.rpc('receive_purchase', {
      p_tenant_id: p.tenantId,
      p_supplier_id: p.supplierId,
      p_invoice_no: p.invoiceNo ?? null,
      p_date: p.purchaseDate ?? null,
      p_notes: p.notes ?? null,
      p_items: p.items,
      p_user_id: p.userId,
    });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    return result as { purchaseId: string; totalAmount: number };
  },

  // ---------------- DISPENSE ----------------
  async dispense(client: SupabaseClient, p: { tenantId: string; userId: string; branchId?: string | null; patientId: string; encounterId?: string | null; notes?: string | null; items: any[] }) {
    const { data, error } = await client.rpc('dispense_items_rpc', {
      p_tenant_id: p.tenantId,
      p_branch_id: p.branchId ?? null,
      p_patient_id: p.patientId,
      p_encounter_id: p.encounterId ?? null,
      p_items: p.items,
      p_notes: p.notes ?? null,
      p_user_id: p.userId,
    });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    return result as { dispenseId: string; totalAmount: number };
  },

  async listDispenses(client: SupabaseClient, tenantId: string, page: number, pageSize: number) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await client
      .from('dispenses')
      .select(`
        *,
        patients:patient_id ( id, uhid, full_name )
      `, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    return { rows: data ?? [], total: count ?? 0, page, pageSize };
  },

  // ---------------- ALERTS ----------------
  async lowStock(client: SupabaseClient, tenantId: string) {
    const { data, error } = await client.from('v_low_stock').select('*').eq('tenant_id', tenantId);
    if (error) throw error;
    return data ?? [];
  },

  async expiringBatches(client: SupabaseClient, tenantId: string) {
    const { data, error } = await client.from('v_expiring_batches').select('*').eq('tenant_id', tenantId);
    if (error) throw error;
    return data ?? [];
  },

  async adjustStock(client: SupabaseClient, p: { tenantId: string; userId: string; batchId: string; qtyDelta: number; reason: string }) {
    const { data, error } = await client.rpc('adjust_stock', {
      p_tenant_id: p.tenantId,
      p_batch_id: p.batchId,
      p_qty_delta: p.qtyDelta,
      p_reason: p.reason,
      p_user_id: p.userId,
    });
    if (error) throw error;
    return { transactionId: data as string };
  },

  async findDefaultBranch(client: SupabaseClient, tenantId: string) {
    const { data } = await client.from('branches').select('id').eq('tenant_id', tenantId).eq('is_active', true).order('branch_code').limit(1).maybeSingle();
    return data;
  },
};