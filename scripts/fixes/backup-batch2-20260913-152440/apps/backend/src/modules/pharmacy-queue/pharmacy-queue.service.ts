import { supabaseForUser } from '../../config/supabase.js';
import { NotFound } from '../../utils/errors.js';
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
    return { rows: data ?? [], total: count ?? 0, page, pageSize };
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
