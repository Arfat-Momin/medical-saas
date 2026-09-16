import { supabaseForUser } from '../../config/supabase.js';
import { billingRepository } from '../billing/billing.repository.js';
import { BadRequest, Conflict, NotFound } from '../../utils/errors.js';
import { audit } from '../../middleware/audit.js';
import type { AuthContext } from '@medical/shared';

const SELECT = `
  id, tenant_id, branch_id, encounter_id, patient_id, doctor_id,
  items, status, dispense_id, notes, created_at, updated_at,
  patients:patient_id ( id, uhid, full_name, mobile, date_of_birth ),
  doctors:doctor_id  ( id, full_name ),
  encounters:encounter_id ( id, encounter_date, chief_complaint )
`;

export const pharmacyQueueService = {
  async list(
    auth: AuthContext,
    token: string,
    opts: { status?: string; page?: number; pageSize?: number } = {},
  ) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 50;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let q = client
      .from('pharmacy_queue')
      .select(SELECT, { count: 'exact' })
      .eq('tenant_id', auth.tenantId)
      .order('created_at', { ascending: false });

    if (opts.status) q = q.eq('status', opts.status);

    const { data, error, count } = await q.range(from, to);
    if (error) throw error;

    // Hydrate each DISPENSED queue row with its MED invoice number.
    const rows = data ?? [];
    const dispenseIds = rows
      .map((r: any) => r.dispense_id)
      .filter((id: string | null) => !!id);
    const invoices = dispenseIds.length
      ? await billingRepository.findInvoicesBySource(client, auth.tenantId, 'PHARMACY', dispenseIds)
      : {};
    const enriched = rows.map((r: any) => {
      const inv = r.dispense_id ? invoices[r.dispense_id] : undefined;
      return {
        ...r,
        pharmacy_invoice: inv
          ? { id: inv.id, invoice_no: inv.invoice_no, total_amount: inv.total_amount, status: inv.status }
          : null,
      };
    });

    return { rows: enriched, total: count ?? 0, page, pageSize };
  },

  async getById(auth: AuthContext, token: string, id: string) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const { data, error } = await client
      .from('pharmacy_queue')
      .select(SELECT)
      .eq('tenant_id', auth.tenantId)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw NotFound('Queue item not found');
    return data;
  },

  async markDispensed(
    auth: AuthContext,
    token: string,
    id: string,
    input: { dispenseId: string },
  ) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);

    const { data: before } = await client
      .from('pharmacy_queue')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('id', id)
      .maybeSingle();
    if (!before) throw NotFound('Queue item not found');
    if (before.status === 'DISPENSED') throw Conflict('Already marked dispensed');
    if (before.status === 'CANCELLED') throw Conflict('Cannot dispense a cancelled queue item');

    // Validate the referenced dispense exists, belongs to this tenant,
    // and is for the same patient as the queue item.
    const { data: dispense } = await client
      .from('dispenses')
      .select('id, patient_id')
      .eq('tenant_id', auth.tenantId)
      .eq('id', input.dispenseId)
      .maybeSingle();
    if (!dispense) throw BadRequest('Dispense not found');
    if (dispense.patient_id !== before.patient_id) {
      throw BadRequest('Dispense belongs to a different patient');
    }

    const { data, error } = await client
      .from('pharmacy_queue')
      .update({ status: 'DISPENSED', dispense_id: input.dispenseId })
      .eq('tenant_id', auth.tenantId)
      .eq('id', id)
      .select(SELECT)
      .single();
    if (error) throw error;

    await audit({
      actorUserId: auth.userId,
      action: 'PHARMACY_QUEUE_DISPENSED',
      entity: 'pharmacy_queue',
      entityId: id,
      after: { dispenseId: input.dispenseId },
    });

    return data;
  },

  async cancel(auth: AuthContext, token: string, id: string) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);

    const { data: before } = await client
      .from('pharmacy_queue')
      .select('status')
      .eq('tenant_id', auth.tenantId)
      .eq('id', id)
      .maybeSingle();
    if (!before) throw NotFound('Queue item not found');
    if (before.status !== 'PENDING') {
      throw Conflict(`Cannot cancel - current status is ${before.status}`);
    }

    const { data, error } = await client
      .from('pharmacy_queue')
      .update({ status: 'CANCELLED' })
      .eq('tenant_id', auth.tenantId)
      .eq('id', id)
      .select(SELECT)
      .single();
    if (error) throw error;

    await audit({
      actorUserId: auth.userId,
      action: 'PHARMACY_QUEUE_CANCELLED',
      entity: 'pharmacy_queue',
      entityId: id,
    });

    return data;
  },
};