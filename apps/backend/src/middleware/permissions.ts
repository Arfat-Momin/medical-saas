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

export const requireRole =
  (...roles: string[]): RequestHandler =>
  (req, _res, next) => {
    const userRoles = req.auth?.roles ?? [];
    if (!roles.some((r) => userRoles.includes(r))) return next(Forbidden('Insufficient role'));
    next();
  };
