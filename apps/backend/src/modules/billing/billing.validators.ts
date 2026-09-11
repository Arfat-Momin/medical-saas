import { z } from 'zod';

const nz = z.union([z.number(), z.string()]).optional();

// ---------- Billable items ----------
export const createBillableItemSchema = z.object({
  code:     z.string().max(50).nullable().optional(),
  name:     z.string().min(1).max(200),
  category: z.enum(['CONSULTATION','PROCEDURE','ROOM','SERVICE','OTHER']).default('SERVICE'),
  price:    z.coerce.number().nonnegative().default(0),
  taxRate:  z.coerce.number().min(0).max(100).default(0),
});
export const updateBillableItemSchema = createBillableItemSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export const listBillableItemsQuerySchema = z.object({
  search:    z.string().max(100).optional(),
  category:  z.string().optional(),
  page:      z.coerce.number().int().min(1).default(1),
  pageSize:  z.coerce.number().int().min(1).max(200).default(50),
});

// ---------- Invoice ----------
export const invoiceItemSchema = z.object({
  itemType:    z.enum(['MANUAL','CONSULTATION','LAB','PHARMACY','PROCEDURE','IPD']).default('MANUAL'),
  sourceId:    z.string().uuid().nullable().optional(),
  description: z.string().min(1).max(300),
  qty:         z.coerce.number().int().positive().default(1),
  unitPrice:   z.coerce.number().nonnegative().default(0),
  discount:    z.coerce.number().nonnegative().default(0),
  taxRate:     z.coerce.number().min(0).max(100).default(0),
});

export const createInvoiceSchema = z.object({
  patientId:   z.string().uuid(),
  encounterId: z.string().uuid().nullable().optional(),
  branchId:    z.string().uuid().optional(),
  notes:       z.string().max(1000).nullable().optional(),
  discount:    z.coerce.number().nonnegative().default(0),
  items:       z.array(invoiceItemSchema).min(1),
});

export const listInvoicesQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  status:    z.enum(['UNPAID','PARTIAL','PAID','REFUNDED','CANCELLED']).optional(),
  from:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page:      z.coerce.number().int().min(1).default(1),
  pageSize:  z.coerce.number().int().min(1).max(100).default(20),
});

// ---------- Payment ----------
export const recordPaymentSchema = z.object({
  amount:    z.coerce.number().positive(),
  method:    z.enum(['CASH','CARD','UPI','NETBANKING','INSURANCE','CREDIT','OTHER']),
  reference: z.string().max(100).nullable().optional(),
  notes:     z.string().max(500).nullable().optional(),
});

// ---------- Refund ----------
export const refundPaymentSchema = z.object({
  paymentId: z.string().uuid(),
  amount:    z.coerce.number().positive(),
  reason:    z.string().min(1).max(500),
});

// ---------- Auto-bill from encounter ----------
export const invoiceFromEncounterSchema = z.object({
  encounterId:   z.string().uuid(),
  includeConsult: z.boolean().default(true),
  includeLab:     z.boolean().default(true),
  includePharmacy:z.boolean().default(true),
  consultationFee: z.coerce.number().nonnegative().optional(),
});

export type CreateBillableItemInput = z.infer<typeof createBillableItemSchema>;
export type UpdateBillableItemInput = z.infer<typeof updateBillableItemSchema>;
export type ListBillableItemsQuery = z.infer<typeof listBillableItemsQuerySchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;
export type InvoiceFromEncounterInput = z.infer<typeof invoiceFromEncounterSchema>;