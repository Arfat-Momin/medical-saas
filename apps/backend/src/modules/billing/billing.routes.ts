import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requirePermission } from '../../middleware/permissions.js';
import { getAccessToken } from '../../middleware/auth.js';
import { PERMISSIONS } from '@medical/shared';
import {
  createBillableItemSchema, updateBillableItemSchema, listBillableItemsQuerySchema,
  createInvoiceSchema, listInvoicesQuerySchema,
  recordPaymentSchema, refundPaymentSchema, invoiceFromEncounterSchema,
} from './billing.validators.js';
import { billingService } from './billing.service.js';

export const billingRouter = Router();

// ---- Billable items master ----
billingRouter.get('/items',
  requirePermission(PERMISSIONS.BILLING_READ),
  asyncHandler(async (req, res) => {
    const q = listBillableItemsQuerySchema.parse(req.query);
    res.json(await billingService.listBillableItems(req.auth!, getAccessToken(req), q));
  }),
);
billingRouter.post('/items',
  requirePermission(PERMISSIONS.BILLING_MANAGE),
  asyncHandler(async (req, res) => {
    const input = createBillableItemSchema.parse(req.body);
    res.status(201).json(await billingService.createBillableItem(req.auth!, getAccessToken(req), input));
  }),
);
billingRouter.patch('/items/:id',
  requirePermission(PERMISSIONS.BILLING_MANAGE),
  asyncHandler(async (req, res) => {
    const patch = updateBillableItemSchema.parse(req.body);
    res.json(await billingService.updateBillableItem(req.auth!, getAccessToken(req), req.params.id!, patch));
  }),
);

// ---- Invoices ----
billingRouter.get('/invoices',
  requirePermission(PERMISSIONS.BILLING_READ),
  asyncHandler(async (req, res) => {
    const q = listInvoicesQuerySchema.parse(req.query);
    res.json(await billingService.listInvoices(req.auth!, getAccessToken(req), q));
  }),
);
billingRouter.get('/invoices/:id',
  requirePermission(PERMISSIONS.BILLING_READ),
  asyncHandler(async (req, res) => {
    res.json(await billingService.getInvoice(req.auth!, getAccessToken(req), req.params.id!));
  }),
);
billingRouter.post('/invoices',
  requirePermission(PERMISSIONS.BILLING_MANAGE),
  asyncHandler(async (req, res) => {
    const input = createInvoiceSchema.parse(req.body);
    res.status(201).json(await billingService.createInvoice(req.auth!, getAccessToken(req), input));
  }),
);
billingRouter.post('/invoices/from-encounter',
  requirePermission(PERMISSIONS.BILLING_MANAGE),
  asyncHandler(async (req, res) => {
    const input = invoiceFromEncounterSchema.parse(req.body);
    res.status(201).json(await billingService.invoiceFromEncounter(req.auth!, getAccessToken(req), input));
  }),
);

// ---- Sub-invoices for a combined invoice ----
billingRouter.get('/invoices/:id/sub-invoices',
  requirePermission(PERMISSIONS.BILLING_READ),
  asyncHandler(async (req, res) => {
    res.json(await billingService.listSubInvoices(req.auth!, getAccessToken(req), req.params.id!));
  }),
);

// ---- Update discount on an invoice ----
billingRouter.patch('/invoices/:id/discount',
  requirePermission(PERMISSIONS.BILLING_MANAGE),
  asyncHandler(async (req, res) => {
    const schema = z.object({ discount: z.coerce.number().min(0).max(1_000_000) });
    const { discount } = schema.parse(req.body);
    res.json(await billingService.updateDiscount(req.auth!, getAccessToken(req), req.params.id!, discount));
  }),
);
// ---- Payments ----
billingRouter.post('/invoices/:id/payments',
  requirePermission(PERMISSIONS.BILLING_MANAGE),
  asyncHandler(async (req, res) => {
    const input = recordPaymentSchema.parse(req.body);
    res.status(201).json(await billingService.recordPayment(req.auth!, getAccessToken(req), req.params.id!, input));
  }),
);

// ---- Refunds ----
billingRouter.post('/invoices/:id/refunds',
  requirePermission(PERMISSIONS.BILLING_REFUND),
  asyncHandler(async (req, res) => {
    const input = refundPaymentSchema.parse(req.body);
    res.status(201).json(await billingService.refundPayment(req.auth!, getAccessToken(req), req.params.id!, input));
  }),
);

// ---- Per-department invoice views ----
billingRouter.get('/doctor-invoices',
  requirePermission(PERMISSIONS.BILLING_READ),
  asyncHandler(async (req, res) => {
    const q = listInvoicesQuerySchema.parse(req.query);
    res.json(await billingService.listDoctorInvoices(req.auth!, getAccessToken(req), q));
  }),
);
billingRouter.get('/pharmacy-invoices',
  requirePermission(PERMISSIONS.PHARMACY_READ),
  asyncHandler(async (req, res) => {
    const q = listInvoicesQuerySchema.parse(req.query);
    res.json(await billingService.listPharmacyInvoices(req.auth!, getAccessToken(req), q));
  }),
);
billingRouter.get('/lab-invoices',
  requirePermission(PERMISSIONS.LAB_READ),
  asyncHandler(async (req, res) => {
    const q = listInvoicesQuerySchema.parse(req.query);
    res.json(await billingService.listLabInvoices(req.auth!, getAccessToken(req), q));
  }),
);