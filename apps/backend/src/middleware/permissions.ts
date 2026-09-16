import type { RequestHandler } from 'express';
import { Forbidden } from '../utils/errors.js';
import type { Permission } from '@medical/shared';

export const requirePermission =
  (...required: Permission[]): RequestHandler =>
  (req, _res, next) => {
    const perms = req.auth?.permissions ?? [];
    const ok = required.every((p) => perms.includes(p));
    if (!ok) return next(Forbidden(`Missing permission: ${required.join(', ')}`));
    next();
  };

/**
 * Like requirePermission, but passes when the caller holds AT LEAST ONE
 * of the listed permissions. Use this on shared read endpoints (staff
 * directory, branch list, ...) that are legitimately needed by several
 * roles for dropdowns — while still excluding roles that have no
 * business enumerating the data.
 */
export const requireAnyPermission =
  (...required: Permission[]): RequestHandler =>
  (req, _res, next) => {
    const perms = req.auth?.permissions ?? [];
    const ok = required.some((p) => perms.includes(p));
    if (!ok) return next(Forbidden(`Missing any of: ${required.join(', ')}`));
    next();
  };

export const requireRole =
  (...roles: string[]): RequestHandler =>
  (req, _res, next) => {
    const userRoles = req.auth?.roles ?? [];
    if (!roles.some((r) => userRoles.includes(r))) return next(Forbidden('Insufficient role'));
    next();
  };