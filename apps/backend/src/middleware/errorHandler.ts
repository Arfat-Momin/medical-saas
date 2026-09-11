import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { logger } from '../config/logger.js';
import { isProd } from '../config/env.js';

export const notFoundHandler = (_req: unknown, res: any) =>
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed',
               details: err.flatten().fieldErrors },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  logger.error({ err, requestId: req.id }, 'Unhandled error');
  return res.status(500).json({
    error: { code: 'INTERNAL', message: 'Internal server error',
             ...(isProd ? {} : { details: (err as Error)?.message }) },
  });
};
