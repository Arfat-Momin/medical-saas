import { supabaseForUser } from '../../config/supabase.js';
import { pharmacyRepository as repo } from './pharmacy.repository.js';
import { billingRepository } from '../billing/billing.repository.js';
import { BadRequest, NotFound } from '../../utils/errors.js';
import { audit } from '../../middleware/audit.js';
import type { AuthContext } from '@medical/shared';
import type {
  CreateMedicineInput, UpdateMedicineInput,
  CreateSupplierInput, UpdateSupplierInput,
  ReceivePurchaseInput, DispenseInput, AdjustStockInput,
  ListMedicinesQuery,
} from './pharmacy.validators.js';

export const pharmacyService = {
  // MEDICINES
  async listMedicines(auth: AuthContext, token: string, q: ListMedicinesQuery) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    return repo.listMedicines(supabaseForUser(token), auth.tenantId, q);
  },
  async createMedicine(auth: AuthContext, token: string, input: CreateMedicineInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const med = await repo.createMedicine(client, {
      tenant_id: auth.tenantId,
      code: input.code ?? null,
      name: input.name,
      generic_name: input.genericName ?? null,
      manufacturer: input.manufacturer ?? null,
      category: input.category ?? null,
      unit: input.unit ?? null,
      hsn_code: input.hsnCode ?? null,
      gst_rate: input.gstRate ?? 0,
      reorder_level: input.reorderLevel,
    });
    await audit({ actorUserId: auth.userId, action: 'MEDICINE_CREATED', entity: 'medicines', entityId: med.id, after: med });
    return med;
  },
  async updateMedicine(auth: AuthContext, token: string, id: string, patch: UpdateMedicineInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const before = await repo.findMedicine(client, auth.tenantId, id);
    if (!before) throw NotFound('Medicine not found');

    const dbPatch: Record<string, unknown> = {};
    if (patch.name !== undefined)         dbPatch.name = patch.name;
    if (patch.genericName !== undefined)  dbPatch.generic_name = patch.genericName;
    if (patch.manufacturer !== undefined) dbPatch.manufacturer = patch.manufacturer;
    if (patch.category !== undefined)     dbPatch.category = patch.category;
    if (patch.unit !== undefined)         dbPatch.unit = patch.unit;
    if (patch.hsnCode !== undefined)      dbPatch.hsn_code = patch.hsnCode;
    if (patch.gstRate !== undefined)      dbPatch.gst_rate = patch.gstRate;
    if (patch.reorderLevel !== undefined) dbPatch.reorder_level = patch.reorderLevel;
    if (patch.isActive !== undefined)     dbPatch.is_active = patch.isActive;

    const after = await repo.updateMedicine(client, auth.tenantId, id, dbPatch);
    await audit({ actorUserId: auth.userId, action: 'MEDICINE_UPDATED', entity: 'medicines', entityId: id, before, after });
    return after;
  },

  // SUPPLIERS
  async listSuppliers(auth: AuthContext, token: string) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    return repo.listSuppliers(supabaseForUser(token), auth.tenantId);
  },
  async createSupplier(auth: AuthContext, token: string, input: CreateSupplierInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const s = await repo.createSupplier(client, {
      tenant_id: auth.tenantId,
      code: input.code ?? null,
      name: input.name,
      contact_person: input.contactPerson ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      gstin: input.gstin ?? null,
    });
    await audit({ actorUserId: auth.userId, action: 'SUPPLIER_CREATED', entity: 'suppliers', entityId: s.id, after: s });
    return s;
  },
  async updateSupplier(auth: AuthContext, token: string, id: string, patch: UpdateSupplierInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const before = await repo.findSupplier(client, auth.tenantId, id);
    if (!before) throw NotFound('Supplier not found');

    const dbPatch: Record<string, unknown> = {};
    if (patch.name !== undefined)          dbPatch.name = patch.name;
    if (patch.contactPerson !== undefined) dbPatch.contact_person = patch.contactPerson;
    if (patch.phone !== undefined)         dbPatch.phone = patch.phone;
    if (patch.email !== undefined)         dbPatch.email = patch.email;
    if (patch.address !== undefined)       dbPatch.address = patch.address;
    if (patch.gstin !== undefined)         dbPatch.gstin = patch.gstin;
    if (patch.isActive !== undefined)      dbPatch.is_active = patch.isActive;

    const after = await repo.updateSupplier(client, auth.tenantId, id, dbPatch);
    await audit({ actorUserId: auth.userId, action: 'SUPPLIER_UPDATED', entity: 'suppliers', entityId: id, before, after });
    return after;
  },

  // BATCHES
  async listBatches(auth: AuthContext, token: string, medicineId?: string, onlyInStock?: boolean) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    return repo.listBatches(supabaseForUser(token), auth.tenantId, medicineId, onlyInStock ?? false);
  },

  // PURCHASES
  async listPurchases(auth: AuthContext, token: string, page: number, pageSize: number) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    return repo.listPurchases(supabaseForUser(token), auth.tenantId, page, pageSize);
  },
  async receivePurchase(auth: AuthContext, token: string, input: ReceivePurchaseInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const result = await repo.receivePurchase(client, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      supplierId: input.supplierId,
      invoiceNo: input.invoiceNo ?? null,
      purchaseDate: input.purchaseDate,
      notes: input.notes ?? null,
      items: input.items,
    });
    await audit({
      actorUserId: auth.userId,
      action: 'PURCHASE_RECEIVED',
      entity: 'purchases',
      entityId: result.purchaseId,
      after: { totalAmount: result.totalAmount, itemCount: input.items.length },
    });
    return result;
  },

  // BARCODE LOOKUP
  async getMedicineByBarcode(auth: AuthContext, token: string, barcode: string) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const med = await repo.findMedicineByBarcode(client, auth.tenantId, barcode);
    if (!med) throw NotFound('Medicine not found for this barcode');
    return med;
  },

  // DISPENSE
  async dispense(auth: AuthContext, token: string, input: DispenseInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);

    let branchId = input.branchId;
    if (!branchId) {
      const def = await repo.findDefaultBranch(client, auth.tenantId);
      branchId = def?.id;
    }

    const result = await repo.dispense(client, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      branchId: branchId ?? null,
      patientId: input.patientId,
      encounterId: input.encounterId ?? null,
      notes: input.notes ?? null,
      items: input.items,
    });

    await audit({
      actorUserId: auth.userId,
      action: 'DISPENSE_COMPLETED',
      entity: 'dispenses',
      entityId: result.dispenseId,
      after: { totalAmount: result.totalAmount, itemCount: input.items.length },
    });

    // Auto-generate invoice from dispense
    const { data: dispenseItems } = await client
      .from('dispense_items')
      .select('medicine_name, qty, unit_price, amount')
      .eq('dispense_id', result.dispenseId);

    const invoiceItems = (dispenseItems ?? []).map((item: any) => ({
      itemType: 'PHARMACY' as const,
      sourceId: result.dispenseId,
      description: `Medicine: ${item.medicine_name}`,
      qty: item.qty,
      unitPrice: item.unit_price,
      discount: 0,
      taxRate: 0,
    }));

    const invoiceResult = await billingRepository.createInvoice(client, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      branchId: input.branchId!,
      patientId: input.patientId,
      notes: 'Auto-generated from Pharmacy Dispense',
      discount: 0,
      items: invoiceItems,
    });

    return {
      ...result,
      invoiceId: invoiceResult.invoiceId,
      invoiceNo: invoiceResult.invoiceNo,
    };
  },

  async listDispenses(auth: AuthContext, token: string, page: number, pageSize: number) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    return repo.listDispenses(supabaseForUser(token), auth.tenantId, page, pageSize);
  },

  // ALERTS
  async lowStock(auth: AuthContext, token: string) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    return repo.lowStock(supabaseForUser(token), auth.tenantId);
  },
  async expiring(auth: AuthContext, token: string) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    return repo.expiringBatches(supabaseForUser(token), auth.tenantId);
  },

  async adjustStock(auth: AuthContext, token: string, input: AdjustStockInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const result = await repo.adjustStock(client, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      batchId: input.batchId,
      qtyDelta: input.qtyDelta,
      reason: input.reason,
    });
    await audit({
      actorUserId: auth.userId,
      action: 'STOCK_ADJUSTED',
      entity: 'stock_transactions',
      entityId: result.transactionId,
      after: { batchId: input.batchId, qtyDelta: input.qtyDelta, reason: input.reason },
    });
    return result;
  },
};