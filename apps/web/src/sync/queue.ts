import { db, uuid, meta } from '@/db';
import type { QueueItem } from '@/db/schema';
import { getDeviceId } from '@/db';

function calculateRetryDelay(attempt: number): number {
  const base = Math.min(2 ** attempt * 1000, 300000);
  const jitter = base * 0.25 * (Math.random() * 2 - 1);
  return Math.round(base + jitter);
}

export const syncQueue = {
  async enqueue(e: { entity: string; operation: 'create' | 'update' | 'delete'; localId: string; payload: unknown }): Promise<string> {
    const deviceId = await getDeviceId();
    const now = new Date().toISOString();
    const item: QueueItem = {
      id: uuid(),
      entity: e.entity,
      operation: e.operation,
      local_id: e.localId,
      payload: e.payload,
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

  async pending(limit = 20): Promise<QueueItem[]> {
    const now = new Date().toISOString();
    const items = await db.queue.where('status').anyOf('pending', 'failed').toArray();
    const ready = items.filter((i) => !i.next_retry_at || i.next_retry_at <= now);
    ready.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return ready.slice(0, limit);
  },

  async countPending(): Promise<number> {
    return db.queue.where('status').anyOf('pending', 'failed').count();
  },

  async countConflicts(): Promise<number> {
    return db.queue.where('status').anyOf('failed', 'conflict', 'blocked').count();
  },

  async markInflight(id: string) {
    await db.queue.update(id, { status: 'inflight' });
  },

  async markDone(id: string) {
    await db.queue.delete(id);
  },

  async resetInflight(): Promise<number> {
    const keys = await db.queue.where('status').equals('inflight').primaryKeys();
    if (keys.length === 0) return 0;
    await Promise.all(keys.map((k) => db.queue.update(k, { status: 'pending' })));
    return keys.length;
  },

  async markFailed(id: string, error: string) {
    const item = await db.queue.get(id);
    if (!item) return;
    const attempts = item.attempts + 1;
    await db.queue.update(id, {
      status: 'failed',
      attempts,
      last_error: error.slice(0, 500),
      next_retry_at: new Date(Date.now() + calculateRetryDelay(attempts)).toISOString(),
    });
  },

  async markBlocked(id: string, reason: string) {
    const item = await db.queue.get(id);
    if (!item) return;
    await db.queue.update(id, {
      status: 'blocked',
      attempts: item.attempts + 1,
      last_error: reason.slice(0, 500),
      next_retry_at: null,
    });
  },

  async markConflict(id: string, error: string) {
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
    const keys = await db.queue.where('status').equals('failed').primaryKeys();
    await Promise.all(keys.map((k) => db.queue.update(k, { status: 'pending', last_error: null, next_retry_at: null })));
    return keys.length;
  },

  async unblockDependencies(localId: string) {
    const blocked = await db.queue.where('status').equals('blocked').toArray();
    for (const item of blocked) {
      const p = item.payload as any;
      if (
        (item.entity === 'appointments' && p.patientLocalId === localId) ||
        (item.entity === 'encounters' && p.patientLocalId === localId)
      ) {
        await db.queue.update(item.id, { status: 'pending', last_error: null, next_retry_at: null });
      }
    }
  },

  async clearFailed(): Promise<number> {
    return db.queue.where('status').anyOf('failed', 'conflict', 'blocked').delete();
  },

  async listAll(limit = 100): Promise<QueueItem[]> {
    return db.queue.orderBy('created_at').reverse().limit(limit).toArray();
  },

  async listIssues(): Promise<QueueItem[]> {
    const rows = await db.queue.where('status').anyOf('conflict', 'blocked', 'failed').toArray();
    rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return rows;
  },

  async removeById(id: string): Promise<void> {
    await db.queue.delete(id);
  },

  async resetToPending(id: string): Promise<void> {
    await db.queue.update(id, {
      status: 'pending',
      last_error: null,
      next_retry_at: null,
    });
  },

  async clearAll() {
    await db.queue.clear();
  },
};