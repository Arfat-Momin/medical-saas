import { db, uuid, getDeviceId, type QueueItem } from '@/db';

export type { QueueItem };

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
      created_at: now,
    };

    await db.queue.add(item);
    return item.idempotency_key;
  },

  async pending(limit = 20): Promise<QueueItem[]> {
    return db.queue
      .where('status')
      .anyOf('pending', 'failed')
      .limit(limit)
      .sortBy('created_at');
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
    await db.queue.update(id, {
      status: 'failed',
      attempts: item.attempts + 1,
      last_error: error.slice(0, 500),
    });
  },

  async markConflict(id: string, error: string): Promise<void> {
    const item = await db.queue.get(id);
    if (!item) return;
    await db.queue.update(id, {
      status: 'conflict',
      attempts: item.attempts + 1,
      last_error: error.slice(0, 500),
    });
  },

  async retryFailed(): Promise<number> {
    const ids = await db.queue.where('status').equals('failed').primaryKeys();
    await Promise.all(
      ids.map((id) => db.queue.update(id, { status: 'pending', last_error: null })),
    );
    return ids.length;
  },

  async clearFailed(): Promise<number> {
    const n = await db.queue.where('status').anyOf('failed', 'conflict').delete();
    return n;
  },

  async listAll(limit = 100): Promise<QueueItem[]> {
    return db.queue.orderBy('created_at').reverse().limit(limit).toArray();
  },

  async clearAll(): Promise<void> {
    await db.queue.clear();
  },
};
