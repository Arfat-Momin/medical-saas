import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

declare global {
  namespace Express {
    interface Request { id: string; }
  }
}

export const requestId: RequestHandler = (req, res, next) => {
  req.id = (req.headers['x-request-id'] as string) ?? randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
};
