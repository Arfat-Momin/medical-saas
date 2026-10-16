import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getAccessToken } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/permissions.js';
import { financeService } from './finance.service.js';
import { PERMISSIONS } from '@medical/shared';
import type { Request, Response } from 'express';

const router = Router();

/**
 * Finance access matrix (mirrors real hospital ERP):
 * ─────────────────────────────────────────────────
 * HOSPITAL_ADMIN  → full access (FINANCE_READ + FINANCE_MANAGE)
 * ACCOUNTANT      → full access (FINANCE_READ + FINANCE_MANAGE)
 * RECEPTIONIST    → no access (billing-only staff, no ledger)
 * DOCTOR/NURSE    → no access
 * PHARMACIST      → no access
 * LAB_TECHNICIAN  → no access
 */

// ── READ ─────────────────────────────────────────────────────────────────────
// GET /accounts — list ledger entries
router.get('/accounts',
  requirePermission(PERMISSIONS.FINANCE_READ),
  asyncHandler(async (req: Request, res: Response) => {
    const token = getAccessToken(req);
    const result = await financeService.listAccounts(req.auth!, token, req.query);
    res.json(result);
  }),
);

// GET /cash-closing — view day's cash position
router.get('/cash-closing',
  requirePermission(PERMISSIONS.FINANCE_READ),
  asyncHandler(async (req: Request, res: Response) => {
    const { branchId, date } = req.query;
    if (!branchId || typeof branchId !== 'string') {
      res.status(400).json({ error: 'branchId required' });
      return;
    }
    if (!date || typeof date !== 'string') {
      res.status(400).json({ error: 'date required' });
      return;
    }
    const token = getAccessToken(req);
    const result = await financeService.getCashClosing(req.auth!, token, branchId, date);
    res.json(result);
  }),
);

// ── WRITE ────────────────────────────────────────────────────────────────────
// POST /accounts — create manual ledger entry (ADMIN or ACCOUNTANT)
router.post('/accounts',
  requirePermission(PERMISSIONS.FINANCE_MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    const token = getAccessToken(req);
    const result = await financeService.createAccountEntry(req.auth!, token, req.body);
    res.status(201).json(result);
  }),
);

// POST /cash-closing — set actual cash count for the day
router.post('/cash-closing',
  requirePermission(PERMISSIONS.FINANCE_MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    const token = getAccessToken(req);
    const result = await financeService.updateCashClosing(req.auth!, token, req.body);
    res.json(result);
  }),
);

// PATCH /cash-closing/:id/close — lock the day (irreversible — ADMIN only for extra safety)
router.patch('/cash-closing/:id/close',
  requirePermission(PERMISSIONS.FINANCE_MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    const token = getAccessToken(req);
    const id = req.params['id'] as string;
    const result = await financeService.closeCashDay(req.auth!, token, id);
    res.json(result);
  }),
);

export default router;
