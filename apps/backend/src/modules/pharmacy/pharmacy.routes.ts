import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requirePermission } from '../../middleware/permissions.js';
import { getAccessToken } from '../../middleware/auth.js';
import { PERMISSIONS } from '@medical/shared';
import {
  createMedicineSchema, updateMedicineSchema, listMedicinesQuerySchema,
  createSupplierSchema, updateSupplierSchema,
  receivePurchaseSchema, dispenseSchema, adjustStockSchema,
} from './pharmacy.validators.js';
import { pharmacyService } from './pharmacy.service.js';

export const pharmacyRouter = Router();

// Medicines
pharmacyRouter.get('/medicines/barcode/:barcode',
  requirePermission(PERMISSIONS.PHARMACY_READ),
  asyncHandler(async (req, res) => {
    res.json(await pharmacyService.getMedicineByBarcode(req.auth!, getAccessToken(req), req.params.barcode!));
  }),
);

pharmacyRouter.get('/medicines',
  requirePermission(PERMISSIONS.PHARMACY_READ),
  asyncHandler(async (req, res) => {
    const q = listMedicinesQuerySchema.parse(req.query);
    res.json(await pharmacyService.listMedicines(req.auth!, getAccessToken(req), q));
  }),
);
pharmacyRouter.post('/medicines',
  requirePermission(PERMISSIONS.PHARMACY_STOCK),
  asyncHandler(async (req, res) => {
    const input = createMedicineSchema.parse(req.body);
    res.status(201).json(await pharmacyService.createMedicine(req.auth!, getAccessToken(req), input));
  }),
);
pharmacyRouter.patch('/medicines/:id',
  requirePermission(PERMISSIONS.PHARMACY_STOCK),
  asyncHandler(async (req, res) => {
    const patch = updateMedicineSchema.parse(req.body);
    res.json(await pharmacyService.updateMedicine(req.auth!, getAccessToken(req), req.params.id!, patch));
  }),
);

// Suppliers
pharmacyRouter.get('/suppliers',
  requirePermission(PERMISSIONS.PHARMACY_READ),
  asyncHandler(async (req, res) => {
    res.json(await pharmacyService.listSuppliers(req.auth!, getAccessToken(req)));
  }),
);
pharmacyRouter.post('/suppliers',
  requirePermission(PERMISSIONS.PHARMACY_STOCK),
  asyncHandler(async (req, res) => {
    const input = createSupplierSchema.parse(req.body);
    res.status(201).json(await pharmacyService.createSupplier(req.auth!, getAccessToken(req), input));
  }),
);
pharmacyRouter.patch('/suppliers/:id',
  requirePermission(PERMISSIONS.PHARMACY_STOCK),
  asyncHandler(async (req, res) => {
    const patch = updateSupplierSchema.parse(req.body);
    res.json(await pharmacyService.updateSupplier(req.auth!, getAccessToken(req), req.params.id!, patch));
  }),
);

// Batches
pharmacyRouter.get('/batches',
  requirePermission(PERMISSIONS.PHARMACY_READ),
  asyncHandler(async (req, res) => {
    const medicineId = req.query.medicineId as string | undefined;
    const onlyInStock = req.query.onlyInStock === 'true';
    res.json(await pharmacyService.listBatches(req.auth!, getAccessToken(req), medicineId, onlyInStock));
  }),
);

// Purchases
pharmacyRouter.get('/purchases',
  requirePermission(PERMISSIONS.PHARMACY_READ),
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    res.json(await pharmacyService.listPurchases(req.auth!, getAccessToken(req), page, pageSize));
  }),
);
pharmacyRouter.post('/purchases',
  requirePermission(PERMISSIONS.PHARMACY_STOCK),
  asyncHandler(async (req, res) => {
    const input = receivePurchaseSchema.parse(req.body);
    res.status(201).json(await pharmacyService.receivePurchase(req.auth!, getAccessToken(req), input));
  }),
);

// Dispense
pharmacyRouter.post('/dispense',
  requirePermission(PERMISSIONS.PHARMACY_DISPENSE),
  asyncHandler(async (req, res) => {
    const input = dispenseSchema.parse(req.body);
    res.status(201).json(await pharmacyService.dispense(req.auth!, getAccessToken(req), input));
  }),
);
pharmacyRouter.get('/dispenses',
  requirePermission(PERMISSIONS.PHARMACY_READ),
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    res.json(await pharmacyService.listDispenses(req.auth!, getAccessToken(req), page, pageSize));
  }),
);

// Alerts
pharmacyRouter.get('/alerts/low-stock',
  requirePermission(PERMISSIONS.PHARMACY_READ),
  asyncHandler(async (req, res) => {
    res.json(await pharmacyService.lowStock(req.auth!, getAccessToken(req)));
  }),
);
pharmacyRouter.get('/alerts/expiring',
  requirePermission(PERMISSIONS.PHARMACY_READ),
  asyncHandler(async (req, res) => {
    res.json(await pharmacyService.expiring(req.auth!, getAccessToken(req)));
  }),
);

// Adjust stock
pharmacyRouter.post('/adjust',
  requirePermission(PERMISSIONS.PHARMACY_STOCK),
  asyncHandler(async (req, res) => {
    const input = adjustStockSchema.parse(req.body);
    res.json(await pharmacyService.adjustStock(req.auth!, getAccessToken(req), input));
  }),
);