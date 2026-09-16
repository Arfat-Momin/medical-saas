import { supabaseForUser } from '../../config/supabase.js';
import { billingRepository as repo } from './billing.repository.js';
import { BadRequest, NotFound, Conflict } from '../../utils/errors.js';
import { audit } from '../../middleware/audit.js';
import type { AuthContext } from '@medical/shared';
import type {
  CreateBillableItemInput, UpdateBillableItemInput, ListBillableItemsQuery,
  CreateInvoiceInput, ListInvoicesQuery,
  RecordPaymentInput, RefundPaymentInput, InvoiceFromEncounterInput,
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
    if (input.amount > Number(inv.balance_amount)) throw BadRequest(`Payment exceeds balance (Rs.${inv.balance_amount})`);

    const result = await repo.recordPayment(client, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      invoiceId,
      amount: input.amount,
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
};