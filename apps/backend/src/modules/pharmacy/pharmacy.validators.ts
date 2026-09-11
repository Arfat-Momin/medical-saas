import { z } from 'zod';

const nz = z.union([z.number(), z.string(), z.null()]).optional();

// ---- Medicines ----
export const createMedicineSchema = z.object({
  code: z.string().max(50).nullable().optional(),
  name: z.string().min(1).max(200),
  genericName: z.string().max(200).nullable().optional(),
  manufacturer: z.string().max(200).nullable().optional(),
  category: z.string().max(50).nullable().optional(),
  unit: z.string().max(20).nullable().optional(),
  hsnCode: z.string().max(20).nullable().optional(),
  gstRate: nz,
  reorderLevel: z.coerce.number().int().min(0).default(10),
});

export const updateMedicineSchema = createMedicineSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const listMedicinesQuerySchema = z.object({
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(20),
  activeOnly: z.coerce.boolean().default(true),
});

// ---- Suppliers ----
export const createSupplierSchema = z.object({
  code: z.string().max(50).nullable().optional(),
  name: z.string().min(1).max(200),
  contactPerson: z.string().max(200).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  gstin: z.string().max(20).nullable().optional(),
});
export const updateSupplierSchema = createSupplierSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// ---- Purchase ----
export const receivePurchaseSchema = z.object({
  supplierId: z.string().uuid(),
  invoiceNo: z.string().max(100).nullable().optional(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(1000).nullable().optional(),
  items: z.array(z.object({
    medicineId: z.string().uuid(),
    batchNo: z.string().min(1).max(50),
    expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    qty: z.coerce.number().int().positive(),
    purchasePrice: z.coerce.number().nonnegative().default(0),
    mrp: z.coerce.number().nonnegative().nullable().optional(),
    sellingPrice: z.coerce.number().nonnegative().nullable().optional(),
  })).min(1),
});

// ---- Dispense ----
export const dispenseSchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().nullable().optional(),
  branchId: z.string().uuid().optional(),
  notes: z.string().max(1000).nullable().optional(),
  items: z.array(z.object({
    medicineId: z.string().uuid(),
    qty: z.coerce.number().int().positive(),
  })).min(1),
});

// ---- Adjust stock ----
export const adjustStockSchema = z.object({
  batchId: z.string().uuid(),
  qtyDelta: z.coerce.number().int().refine((n) => n !== 0, 'Cannot be zero'),
  reason: z.string().min(1).max(500),
});

export type CreateMedicineInput = z.infer<typeof createMedicineSchema>;
export type UpdateMedicineInput = z.infer<typeof updateMedicineSchema>;
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type ReceivePurchaseInput = z.infer<typeof receivePurchaseSchema>;
export type DispenseInput = z.infer<typeof dispenseSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type ListMedicinesQuery = z.infer<typeof listMedicinesQuerySchema>;