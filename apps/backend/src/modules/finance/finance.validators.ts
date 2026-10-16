import { z } from 'zod';

export const listAccountsSchema = z.object({
  branchId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  entryType: z.enum(['INCOME', 'EXPENSE', 'REFUND', 'ADJUSTMENT']).optional(),
  category: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
});

export const createAccountEntrySchema = z.object({
  branchId: z.string().uuid(),
  entryType: z.enum(['INCOME', 'EXPENSE', 'REFUND', 'ADJUSTMENT']),
  category: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().min(0.01),
  paymentMode: z.enum(['CASH','CARD','UPI','CHEQUE','NEFT_RTGS','INSURANCE','PACKAGE','CREDIT','OTHER']),
  coverageType: z.string().nullable().optional(),
  referenceNo: z.string().nullable().optional(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
});

export const getCashClosingSchema = z.object({
  branchId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
});

export const createCashClosingSchema = z.object({
  branchId: z.string().uuid(),
  closingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  actualCash: z.number().min(0),
  notes: z.string().nullable().optional(),
});
