export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const BadRequest   = (m = 'Bad request', d?: unknown) => new AppError(400, 'BAD_REQUEST', m, d);
export const Unauthorized = (m = 'Unauthorized')            => new AppError(401, 'UNAUTHORIZED', m);
export const Forbidden    = (m = 'Forbidden')               => new AppError(403, 'FORBIDDEN', m);
export const NotFound     = (m = 'Not found')               => new AppError(404, 'NOT_FOUND', m);
export const Conflict     = (m = 'Conflict', d?: unknown)   => new AppError(409, 'CONFLICT', m, d);
export const Internal     = (m = 'Internal server error')   => new AppError(500, 'INTERNAL', m);
