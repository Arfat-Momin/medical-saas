import { db, uuid, getDeviceId, type QueueItem } from '@/db';

export type { QueueItem };

/** Exponential backoff: 2^attempts seconds, capped at 5 min, with +/- 25% jitter. */
function backoffMs(attempts: number): number {
  const base = Math.min(2 ** attempts * 1000, 5 * 60 * 1000);
  const jitter = base * 0.25 * (Math.random() * 2 - 1);
  return Math.round(base + jitter);
}

export const syncQueue = {
  async enqueue(input: {
    entity: string;
    operation: 'create' | 'update' | 'delete';
    localId: string;
    payload: unknown;
  }): Promise<string> {
    const deviceId = await getDeviceId();
    const now = new Date().toISOString();
    const item: QueueItem = {
      id: uuid(),
      entity: input.entity,
      operation: input.operation,
      local_id: input.localId,
      payload: input.payload,
      idempotency_key: uuid(),
      device_id: deviceId,
      client_timestamp: now,
      attempts: 0,
      last_error: null,
      status: 'pending',
      next_retry_at: null,
      created_at: now,
    };
    await db.queue.add(item);
    return item.idempotency_key;
  },

  /** Ready-to-send items: pending or failed AND not yet in backoff window. */
  async pending(limit = 20): Promise<QueueItem[]> {
    const nowIso = new Date().toISOString();
    const rows = await db.queue
      .where('status')
      .anyOf('pending', 'failed')
      .toArray();

    const ready = rows.filter(
      (r) => !r.next_retry_at || r.next_retry_at <= nowIso,
    );
    ready.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return ready.slice(0, limit);
  },

  async countPending(): Promise<number> {
    return db.queue.where('status').anyOf('pending', 'failed').count();
  },

  async countFailed(): Promise<number> {
    return db.queue.where('status').anyOf('failed', 'conflict').count();
  },

  async markInflight(id: string): Promise<void> {
    await db.queue.update(id, { status: 'inflight' });
  },

  async markDone(id: string): Promise<void> {
    await db.queue.delete(id);
  },

  async markFailed(id: string, error: string): Promise<void> {
    const item = await db.queue.get(id);
    if (!item) return;
    const attempts = item.attempts + 1;
    await db.queue.update(id, {
      status: 'failed',
      attempts,
      last_error: error.slice(0, 500),
      next_retry_at: new Date(Date.now() + backoffMs(attempts)).toISOString(),
    });
  },

  async markConflict(id: string, error: string): Promise<void> {
    const item = await db.queue.get(id);
    if (!item) return;
    await db.queue.update(id, {
      status: 'conflict',
      attempts: item.attempts + 1,
      last_error: error.slice(0, 500),
      next_retry_at: null,
    });
  },

  async retryFailed(): Promise<number> {
    const ids = await db.queue.where('status').equals('failed').primaryKeys();
    await Promise.all(
      ids.map((id) =>
        db.queue.update(id, { status: 'pending', last_error: null, next_retry_at: null }),
      ),
    );
    return ids.length;
  },

  async clearFailed(): Promise<number> {
    return db.queue.where('status').anyOf('failed', 'conflict').delete();
  },

  async listAll(limit = 100): Promise<QueueItem[]> {
    return db.queue.orderBy('created_at').reverse().limit(limit).toArray();
  },

  async clearAll(): Promise<void> {
    await db.queue.clear();
  },
};