import type { SupabaseClient } from '@supabase/supabase-js';

const INVOICE_SELECT = `
  id, tenant_id, branch_id, invoice_no, patient_id, encounter_id,
  status, subtotal, discount_amount, tax_amount,
  total_amount, paid_amount, balance_amount,
  notes, created_at, updated_at, finalized_at,
  invoice_type, source_reference_id,
  patients:patient_id ( id, uhid, full_name, mobile ),
  branches:branch_id ( id, name, branch_code )
`;

const ITEM_SELECT = `
  id, tenant_id, invoice_id, item_type, source_id, description,
  qty, unit_price, discount, tax_rate, amount, created_at
`;

export type InvoiceType = 'COMBINED' | 'DOCTOR' | 'PHARMACY' | 'LAB';

export const billingRepository = {
  async listBillableItems(client: SupabaseClient, tenantId: string, opts: { search?: string; category?: string; page: number; pageSize: number }) {
    const from = (opts.page - 1) * opts.pageSize;
    const to = from + opts.pageSize - 1;
    let q = client.from('billable_items').select('*', { count: 'exact' })
      .eq('tenant_id', tenantId).eq('is_active', true).order('name');
    if (opts.category) q = q.eq('category', opts.category);
    if (opts.search) {
      const s = opts.search.replace(/[,%_]/g, '');
      q = q.or(`name.ilike.%${s}%,code.ilike.%${s}%`);
    }
    const { data, error, count } = await q.range(from, to);
    if (error) throw error;
    return { rows: data ?? [], total: count ?? 0, page: opts.page, pageSize: opts.pageSize };
  },
  async findBillableItem(client: SupabaseClient, tenantId: string, id: string) {
    const { data, error } = await client.from('billable_items').select('*').eq('tenant_id', tenantId).eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },
  async createBillableItem(client: SupabaseClient, payload: Record<string, unknown>) {
    const { data, error } = await client.from('billable_items').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  },
  async updateBillableItem(client: SupabaseClient, tenantId: string, id: string, patch: Record<string, unknown>) {
    const { data, error } = await client.from('billable_items').update(patch).eq('tenant_id', tenantId).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },

  async listInvoices(
    client: SupabaseClient,
    tenantId: string,
    opts: {
      invoiceType?: InvoiceType;
      patientId?: string;
      status?: string;
      from?: string;
      to?: string;
      page: number;
      pageSize: number;
    },
  ) {
    const from = (opts.page - 1) * opts.pageSize;
    const to = from + opts.pageSize - 1;
    let q = client.from('invoices').select(INVOICE_SELECT, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('invoice_no', { ascending: false });

    // Default to combined invoices for the main Invoices page.
    q = q.eq('invoice_type', opts.invoiceType ?? 'COMBINED');

    if (opts.patientId) q = q.eq('patient_id', opts.patientId);
    if (opts.status)    q = q.eq('status', opts.status);
    if (opts.from)      q = q.gte('created_at', opts.from);
    if (opts.to)        q = q.lte('created_at', opts.to + 'T23:59:59.999Z');

    const { data, error, count } = await q.range(from, to);
    if (error) throw error;
    return { rows: data ?? [], total: count ?? 0, page: opts.page, pageSize: opts.pageSize };
  },

  async findInvoiceFull(client: SupabaseClient, tenantId: string, id: string) {
    const { data: inv, error: e1 } = await client.from('invoices').select(INVOICE_SELECT)
      .eq('tenant_id', tenantId).eq('id', id).maybeSingle();
    if (e1) throw e1;
    if (!inv) return null;

    const { data: items } = await client.from('invoice_items').select(ITEM_SELECT)
      .eq('tenant_id', tenantId).eq('invoice_id', id).order('created_at');
    const { data: payments } = await client.from('payments').select('*, received:received_by ( full_name )')
      .eq('tenant_id', tenantId).eq('invoice_id', id).order('received_at', { ascending: false });
    const { data: refunds } = await client.from('refunds').select('*, refunded:refunded_by ( full_name )')
      .eq('tenant_id', tenantId).eq('invoice_id', id).order('refunded_at', { ascending: false });

    return { ...inv, items: items ?? [], payments: payments ?? [], refunds: refunds ?? [] };
  },

  async createInvoice(client: SupabaseClient, p: { tenantId: string; userId: string; branchId: string; patientId: string; encounterId?: string | null; notes?: string | null; discount: number; items: any[] }) {
    const { data, error } = await client.rpc('create_invoice', {
      p_tenant_id: p.tenantId,
      p_branch_id: p.branchId,
      p_patient_id: p.patientId,
      p_encounter_id: p.encounterId ?? null,
      p_notes: p.notes ?? null,
      p_discount: p.discount,
      p_items: p.items,
      p_user_id: p.userId,
    });
    if (error) throw error;
    const r = Array.isArray(data) ? data[0] : data;
    return r as { invoiceId: string; invoiceNo: string; totalAmount: number };
  },

  async recordPayment(client: SupabaseClient, p: { tenantId: string; userId: string; invoiceId: string; amount: number; method: string; reference?: string | null; notes?: string | null }) {
    const { data, error } = await client.rpc('record_payment', {
      p_tenant_id: p.tenantId,
      p_invoice_id: p.invoiceId,
      p_amount: p.amount,
      p_method: p.method,
      p_reference: p.reference ?? null,
      p_notes: p.notes ?? null,
      p_user_id: p.userId,
    });
    if (error) throw error;
    return (Array.isArray(data) ? data[0] : data) as { paymentId: string; paidAmount: number; balanceAmount: number; status: string };
  },

  async refundPayment(client: SupabaseClient, p: { tenantId: string; userId: string; invoiceId: string; paymentId: string; amount: number; reason: string }) {
    const { data, error } = await client.rpc('refund_payment', {
      p_tenant_id: p.tenantId,
      p_invoice_id: p.invoiceId,
      p_payment_id: p.paymentId,
      p_amount: p.amount,
      p_reason: p.reason,
      p_user_id: p.userId,
    });
    if (error) throw error;
    return (Array.isArray(data) ? data[0] : data) as { refundId: string; status: string; balanceAmount: number };
  },

    /**
   * Return every DOCTOR / PHARMACY / LAB invoice for a given patient.
   * Used by the invoice detail page to render the "Source Invoices" panel
   * with per-department paid / unpaid badges.
   */
  async listSubInvoicesForPatient(
    client: SupabaseClient,
    tenantId: string,
    patientId: string,
  ) {
    const { data, error } = await client
      .from('invoices')
      .select(INVOICE_SELECT)
      .eq('tenant_id', tenantId)
      .eq('patient_id', patientId)
      .in('invoice_type', ['DOCTOR', 'PHARMACY', 'LAB'])
      .neq('status', 'CANCELLED')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  /**
   * Patch fields on a single invoice. Used to update discount_amount and
   * the recomputed total / balance / status.
   */
  async updateInvoiceFields(
    client: SupabaseClient,
    tenantId: string,
    invoiceId: string,
    patch: Record<string, unknown>,
  ) {
    const { data, error } = await client
      .from('invoices')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', invoiceId)
      .select(INVOICE_SELECT)
      .single();
    if (error) throw error;
    return data;
  },
async findDefaultBranch(client: SupabaseClient, tenantId: string) {
    const { data, error } = await client.from('branches').select('id')
      .eq('tenant_id', tenantId).eq('is_active', true)
      .order('branch_code').limit(1).maybeSingle();
    if (error) throw error;
    return data;
  },

  async getEncounterSources(client: SupabaseClient, tenantId: string, encounterId: string) {
    const { data: enc } = await client.from('encounters')
      .select('id, branch_id, patient_id, encounter_date, chief_complaint')
      .eq('tenant_id', tenantId).eq('id', encounterId).maybeSingle();
    if (!enc) return null;
    const { data: labs } = await client.from('lab_orders')
      .select('id, total_amount, order_date, items:lab_order_items( test_name, price )')
      .eq('tenant_id', tenantId).eq('encounter_id', encounterId);
    const { data: dispenses } = await client.from('dispenses')
      .select('id, total_amount, created_at, items:dispense_items( medicine_name, qty, unit_price, amount )')
      .eq('tenant_id', tenantId).eq('encounter_id', encounterId);
    return { encounter: enc, labOrders: labs ?? [], dispenses: dispenses ?? [] };
  },

  /** Combined invoice for a patient ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â auto-rebuilt from sub-invoices. */
  async syncCombinedInvoice(client: SupabaseClient, tenantId: string, userId: string, patientId: string): Promise<string | null> {
    const { data, error } = await client.rpc('sync_combined_invoice', {
      p_tenant_id: tenantId,
      p_user_id:   userId,
      p_patient_id: patientId,
    });
    if (error) throw error;
    return (data as string) ?? null;
  },

  /**
   * Given a list of source_ids (encounter_id / dispense_id / lab_order_id),
   * return a map of source_id -> { id, invoice_no, total_amount, status }.
   *
   * Used by appointments / lab / pharmacy list pages to surface the
   * department-specific invoice number.
   */
  async findInvoicesBySource(
    client: SupabaseClient,
    tenantId: string,
    sourceType: 'DOCTOR' | 'PHARMACY' | 'LAB',
    sourceIds: string[],
  ): Promise<Record<string, { id: string; invoice_no: string; total_amount: number; status: string }>> {
    if (sourceIds.length === 0) return {};
    const { data, error } = await client
      .from('invoices')
      .select('id, invoice_no, total_amount, status, source_reference_id')
      .eq('tenant_id', tenantId)
      .eq('invoice_type', sourceType)
      .in('source_reference_id', sourceIds)
      .neq('status', 'CANCELLED');
    if (error) throw error;
    const map: Record<string, { id: string; invoice_no: string; total_amount: number; status: string }> = {};
    (data ?? []).forEach((row: any) => {
      map[row.source_reference_id] = {
        id: row.id,
        invoice_no: row.invoice_no,
        total_amount: row.total_amount,
        status: row.status,
      };
    });
    return map;
  },

  /** Find encounters for a list of appointment IDs (appointment_id -> encounter_id). */
  async findEncountersByAppointments(
    client: SupabaseClient,
    tenantId: string,
    appointmentIds: string[],
  ): Promise<Record<string, string>> {
    if (appointmentIds.length === 0) return {};
    const { data, error } = await client
      .from('encounters')
      .select('id, appointment_id')
      .eq('tenant_id', tenantId)
      .in('appointment_id', appointmentIds);
    if (error) throw error;
    const map: Record<string, string> = {};
    (data ?? []).forEach((row: any) => {
      if (row.appointment_id) map[row.appointment_id] = row.id;
    });
    return map;
  },};
