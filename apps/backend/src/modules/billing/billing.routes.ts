import { Router } from 'express';
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