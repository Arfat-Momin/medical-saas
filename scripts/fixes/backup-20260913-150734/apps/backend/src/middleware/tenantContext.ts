import type { RequestHandler } from 'express';
import { Forbidden } from '../utils/errors.js';

/**
 * Blocks Super Admin from ever touching hospital-scoped routes.
 * This is layer 2 of Super Admin isolation (layer 1 = RLS).
 */
export const requireTenant: RequestHandler = (req, _res, next) => {
  if (!req.auth?.tenantId) return next(Forbidden('No tenant context'));
  next();
};

export const requirePlatformAdmin: RequestHandler = (req, _res, next) => {
  if (!req.auth?.isPlatformAdmin) return next(Forbidden('Platform admin only'));
  next();
};

export const requireBranchScope: RequestHandler = (req, _res, next) => {
  const headerBranch = req.headers['x-branch-id'] as string | undefined;
  if (headerBranch) (req as any).branchId = headerBranch;
  next();
};
