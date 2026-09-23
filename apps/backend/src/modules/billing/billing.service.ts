import { supabaseForUser } from '../../config/supabase.js';
import { billingRepository as repo } from './billing.repository.js';
import { BadRequest, NotFound, Conflict } from '../../utils/errors.js';
import { audit } from '../../middleware/audit.js';
import { logger } from '../../config/logger.js';
import type { AuthContext } from '@medical/shared';
import type {
  CreateBillableItemInput, UpdateBillableItemInput, ListBillableItemsQuery,
  CreateInvoiceInput, ListInvoicesQuery,
  RecordPaymentInput, RefundPaymentInput, InvoiceFromEncounterInput,
  ReplaceInvoiceItemsInput, CreateIpdDraftInput,
} from './billing.validators.js';

export const billingService = {
  // ---- Billable items ----
  async listBillableItems(auth: AuthContext, token: string, q: ListBillableItemsQuery) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    return repo.listBillableItems(supabaseForUser(token), auth.tenantId, q);
  },
  async createBillableItem(auth: AuthContext, token: string, input: CreateBillableItemInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const item = await repo.createBillableItem(client, {
      tenant_id: auth.tenantId,
      code: input.code ?? null,
      name: input.name,
      category: input.category,
      price: input.price,
      tax_rate: input.taxRate,
    });
    await audit({ actorUserId: auth.userId, action: 'BILLABLE_ITEM_CREATED', entity: 'billable_items', entityId: item.id, after: item });
    return item;
  },
  async updateBillableItem(auth: AuthContext, token: string, id: string, patch: UpdateBillableItemInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const before = await repo.findBillableItem(client, auth.tenantId, id);
    if (!before) throw NotFound('Item not found');

    const dbPatch: Record<string, unknown> = {};
    if (patch.name !== undefined)     dbPatch.name = patch.name;
    if (patch.category !== undefined) dbPatch.category = patch.category;
    if (patch.price !== undefined)    dbPatch.price = patch.price;
    if (patch.taxRate !== undefined)  dbPatch.tax_rate = patch.taxRate;
    if (patch.isActive !== undefined) dbPatch.is_active = patch.isActive;

    const after = await repo.updateBillableItem(client, auth.tenantId, id, dbPatch);
    await audit({ actorUserId: auth.userId, action: 'BILLABLE_ITEM_UPDATED', entity: 'billable_items', entityId: id, before, after });
    return after;
  },

  // ---- Invoices ----
  async listInvoices(auth: AuthContext, token: string, q: ListInvoicesQuery) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    return repo.listInvoices(supabaseForUser(token), auth.tenantId, q);
  },
  async getInvoiceTotals(auth: AuthContext, token: string, q: ListInvoicesQuery) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    return repo.getInvoiceTotals(supabaseForUser(token), auth.tenantId, q);
  },
  async getInvoice(auth: AuthContext, token: string, id: string) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const inv = await repo.findInvoiceFull(supabaseForUser(token), auth.tenantId, id);
    if (!inv) throw NotFound('Invoice not found');
    return inv;
  },
  async createInvoice(auth: AuthContext, token: string, input: CreateInvoiceInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);

    const branchId = input.branchId ?? (await repo.findDefaultBranch(client, auth.tenantId))?.id ?? null;
    if (!branchId) throw BadRequest('No active branch found');

    const result = await repo.createInvoice(client, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      branchId,
      patientId: input.patientId,
      encounterId: input.encounterId ?? null,
      ipdAdmissionId: input.ipdAdmissionId ?? null,
      invoiceType: input.invoiceType ?? 'COMBINED',
      notes: input.notes ?? null,
      discount: input.discount,
      items: input.items,
    });

    await audit({
      actorUserId: auth.userId,
      action: 'INVOICE_CREATED',
      entity: 'invoices',
      entityId: result.invoiceId,
      after: { invoiceNo: result.invoiceNo, totalAmount: result.totalAmount, itemCount: input.items.length },
    });

    return result;
  },

  // ---- Payments / Refunds ----
  async recordPayment(auth: AuthContext, token: string, invoiceId: string, input: RecordPaymentInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);

    const inv = await repo.findInvoiceFull(client, auth.tenantId, invoiceId);
    if (!inv) throw NotFound('Invoice not found');
    if (inv.status === 'CANCELLED') throw Conflict('Invoice is cancelled');
    if (inv.status === 'PAID') throw Conflict('Invoice already fully paid');
    const balance = Number(inv.balance_amount);
    if (!Number.isFinite(balance)) throw BadRequest('Invoice has invalid balance');
    const EPSILON = 0.005; // half a paisa
    if (input.amount - balance > EPSILON) {
      throw BadRequest(`Payment exceeds balance (Rs.${balance.toFixed(2)})`);
    }
    const effectiveAmount = Math.min(input.amount, balance);

    const result = await repo.recordPayment(client, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      invoiceId,
      amount: effectiveAmount,
      method: input.method,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
    });

    await audit({
      actorUserId: auth.userId,
      action: 'PAYMENT_RECORDED',
      entity: 'invoices',
      entityId: invoiceId,
      after: { paymentId: result.paymentId, amount: input.amount, method: input.method, status: result.status },
    });

    return result;
  },

  async refundPayment(auth: AuthContext, token: string, invoiceId: string, input: RefundPaymentInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);

    const inv = await repo.findInvoiceFull(client, auth.tenantId, invoiceId);
    if (!inv) throw NotFound('Invoice not found');

    const result = await repo.refundPayment(client, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      invoiceId,
      paymentId: input.paymentId,
      amount: input.amount,
      reason: input.reason,
    });

    await audit({
      actorUserId: auth.userId,
      action: 'PAYMENT_REFUNDED',
      entity: 'invoices',
      entityId: invoiceId,
      after: { refundId: result.refundId, amount: input.amount, reason: input.reason, status: result.status },
    });

    return result;
  },

    // ---- Sub-invoice list for the detail page ----
  async listSubInvoices(auth: AuthContext, token: string, invoiceId: string) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);

    const parent = await repo.findInvoiceFull(client, auth.tenantId, invoiceId);
    if (!parent) throw NotFound('Invoice not found');

    const rows = await repo.listSubInvoicesForPatient(
      client,
      auth.tenantId,
      parent.patient_id,
      (parent as any).encounter_id ?? null,
    );
    return { rows };
  },

  // ---- Update discount on the combined invoice ----
  async updateDiscount(
    auth: AuthContext,
    token: string,
    invoiceId: string,
    discount: number,
  ) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);

    const inv = await repo.findInvoiceFull(client, auth.tenantId, invoiceId);
    if (!inv) throw NotFound('Invoice not found');
    if (inv.status === 'CANCELLED') throw Conflict('Invoice is cancelled');

    const subtotal = Number(inv.subtotal) || 0;
    const tax      = Number(inv.tax_amount) || 0;
    const paid     = Number(inv.paid_amount) || 0;

    const total   = Math.max(subtotal - discount + tax, 0);
    const balance = Math.max(total - paid, 0);
    const status  = paid <= 0 ? 'UNPAID' : paid >= total ? 'PAID' : 'PARTIAL';

    const updated = await repo.updateInvoiceFields(client, auth.tenantId, invoiceId, {
      discount_amount: discount,
      total_amount:    total,
      balance_amount:  balance,
      status,
      updated_at:      new Date().toISOString(),
    });

    await audit({
      actorUserId: auth.userId,
      action: 'INVOICE_DISCOUNT_UPDATED',
      entity: 'invoices',
      entityId: invoiceId,
      before: { discount_amount: inv.discount_amount, total_amount: inv.total_amount },
      after:  { discount_amount: discount,           total_amount: total },
    });

    return updated;
  },
// ---- Sync the encounter's single invoice ----
  // Called after every event that could add billable items:
  //   - encounter completion (consultation fee)
  //   - lab order creation (lab items)
  //   - pharmacy dispense (pharmacy items)
  // Idempotent at the DB layer (unique index on invoice_items + recompute trigger).
  async syncEncounterInvoice(auth: AuthContext, token: string, encounterId: string) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);

    const { data, error } = await client.rpc('sync_invoice_from_encounter', {
      p_tenant_id:    auth.tenantId,
      p_user_id:      auth.userId,
      p_encounter_id: encounterId,
    });
    if (error) {
      logger.error({ encounterId, error: error.message }, 'sync_invoice_from_encounter failed');
      throw error;
    }
    return { invoiceId: data as string };
  },
  // ---- Auto-bill from encounter ----
  async invoiceFromEncounter(auth: AuthContext, token: string, input: InvoiceFromEncounterInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);

    const src = await repo.getEncounterSources(client, auth.tenantId, input.encounterId);
    if (!src) throw NotFound('Encounter not found');

    const items: any[] = [];

    if (input.includeConsult) {
      const fee = input.consultationFee ?? 0;
      if (fee > 0) {
        items.push({
          itemType: 'CONSULTATION',
          sourceId: src.encounter.id,
          description: `Consultation - ${src.encounter.encounter_date}`,
          qty: 1,
          unitPrice: fee,
          discount: 0,
          taxRate: 0,
        });
      }
    }

    if (input.includeLab) {
      for (const order of src.labOrders) {
        for (const li of (order as any).items ?? []) {
          items.push({
            itemType: 'LAB',
            sourceId: order.id,
            description: `Lab: ${li.test_name}`,
            qty: 1,
            unitPrice: Number(li.price) || 0,
            discount: 0,
            taxRate: 0,
          });
        }
      }
    }

    if (input.includePharmacy) {
      for (const d of src.dispenses) {
        for (const di of (d as any).items ?? []) {
          items.push({
            itemType: 'PHARMACY',
            sourceId: d.id,
            description: `Medicine: ${di.medicine_name}`,
            qty: Number(di.qty) || 1,
            unitPrice: Number(di.unit_price) || 0,
            discount: 0,
            taxRate: 0,
          });
        }
      }
    }

    if (items.length === 0) throw BadRequest('Nothing to bill - no consultation fee, lab orders or medicines found');

    return billingService.createInvoice(auth, token, {
      patientId: src.encounter.patient_id,
      encounterId: src.encounter.id,
      branchId: src.encounter.branch_id,
      notes: `Auto-billed from encounter on ${src.encounter.encounter_date}`,
      discount: 0,
      items,
    });
  },

  // ---- IPD custom bill ----
  async createIpdDraft(auth: AuthContext, token: string, input: CreateIpdDraftInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const adm = await repo.findAdmissionBasic(client, auth.tenantId, input.admissionId);
    if (!adm) throw NotFound('Admission not found');
    const result = await repo.createIpdDraft(client, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      branchId: adm.branch_id,
      patientId: adm.patient_id,
      admissionId: input.admissionId,
    });
    await audit({
      actorUserId: auth.userId,
      action: 'IPD_DRAFT_INVOICE_CREATED',
      entity: 'invoices',
      entityId: result.invoiceId,
      after: { invoiceNo: result.invoiceNo, admissionId: input.admissionId },
    });
    return result;
  },

  async replaceIpdItems(auth: AuthContext, token: string, invoiceId: string, input: ReplaceInvoiceItemsInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const inv = await repo.findInvoiceFull(client, auth.tenantId, invoiceId);
    if (!inv) throw NotFound('Invoice not found');
    if (inv.invoice_type !== 'IPD') throw BadRequest('Only IPD invoices can be edited with this endpoint');
    if (inv.finalized_at) throw Conflict('Invoice is finalized and cannot be edited');
    const result = await repo.replaceIpdItems(client, {
      tenantId: auth.tenantId,
      invoiceId,
      items: input.items,
      discount: input.discount,
    });
    await audit({
      actorUserId: auth.userId,
      action: 'IPD_INVOICE_ITEMS_REPLACED',
      entity: 'invoices',
      entityId: invoiceId,
      after: { itemCount: input.items.length, totalAmount: result.totalAmount },
    });
    return result;
  },

  async getIpdBillByAdmission(auth: AuthContext, token: string, admissionId: string) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    return repo.getIpdBillByAdmission(client, auth.tenantId, admissionId);
  },

  // ---- Per-department invoice views ----
  async listDoctorInvoices(auth: AuthContext, token: string, q: ListInvoicesQuery) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    return repo.listInvoices(supabaseForUser(token), auth.tenantId, { ...q, invoiceType: 'DOCTOR' });
  },
  async listPharmacyInvoices(auth: AuthContext, token: string, q: ListInvoicesQuery) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    return repo.listInvoices(supabaseForUser(token), auth.tenantId, { ...q, invoiceType: 'PHARMACY' });
  },
  async listLabInvoices(auth: AuthContext, token: string, q: ListInvoicesQuery) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    return repo.listInvoices(supabaseForUser(token), auth.tenantId, { ...q, invoiceType: 'LAB' });
  },

  // ---- Sync a LAB invoice from a lab order (idempotent) ----
  // Called whenever a lab order is created, whether or not it is tied to
  // an encounter. Creates / refreshes the LAB invoice + items, then
  // rebuilds the patient's COMBINED invoice so the LAB section shows up
  // on the main invoice page.
  async syncLabInvoice(auth: AuthContext, token: string, orderId: string) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);

    const { data: order, error: oErr } = await client
      .from('lab_orders')
      .select('id, patient_id, encounter_id')
      .eq('tenant_id', auth.tenantId)
      .eq('id', orderId)
      .maybeSingle();
    if (oErr) throw oErr;
    if (!order) throw NotFound('Lab order not found');

    const { data: invoiceId, error: iErr } = await client.rpc('sync_source_invoice', {
      p_tenant_id:   auth.tenantId,
      p_user_id:     auth.userId,
      p_source_type: 'LAB',
      p_source_id:   orderId,
    });
    if (iErr) {
      logger.error({ orderId, error: iErr.message }, 'sync_source_invoice(LAB) failed');
      throw iErr;
    }

    let combinedInvoiceId: string | null = null;
    try {
      const { data: cid, error: cErr } = await client.rpc('sync_combined_invoice', {
        p_tenant_id:   auth.tenantId,
        p_user_id:     auth.userId,
        p_patient_id:  order.patient_id,
        p_encounter_id: order.encounter_id ?? null,
      });
      if (cErr) throw cErr;
      combinedInvoiceId = (cid as string) ?? null;
    } catch (e) {
      logger.warn({ orderId, patientId: order.patient_id, err: e }, 'sync_combined_invoice failed after lab order');
    }

    return { invoiceId: invoiceId as string, combinedInvoiceId };
  },
};