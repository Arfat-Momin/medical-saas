import { Conflict } from './errors.js';

/**
 * If the client sends `X-Expected-Updated-At`, the server verifies that the
 * record's current `updated_at` matches. If not, throws 409 with the current
 * server state so the client can show a resolution dialog.
 */
export function assertNoConflict(
  expectedUpdatedAt: string | undefined,
  serverUpdatedAt: string | null | undefined,
  currentRecord: unknown,
): void {
  if (!expectedUpdatedAt) return;        // legacy client - skip check
  if (!serverUpdatedAt) return;          // record never updated - no conflict
  if (expectedUpdatedAt === serverUpdatedAt) return;  // timestamps match - all good

  throw Conflict('Record was modified on the server since your last sync', {
    conflict: true,
    server: currentRecord,
    clientUpdatedAt: expectedUpdatedAt,
    serverUpdatedAt,
  });
}
