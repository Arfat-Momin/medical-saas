import { db } from '@/db';
import { queryClient, persister } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/auth.store';
import { syncQueue } from '@/sync/queue';
import { syncEngine } from '@/sync/engine';

export async function clearLocalSession(): Promise<void> {
  // 1. Stop any in-flight sync so we never orphan queue items.
  try { syncEngine.stop(); } catch { /* ignore */ }

  // 2. Clear auth state (JWT, user, tenant, roles, permissions).
  try { useAuthStore.getState().logout(); } catch { /* ignore */ }

  // 3. Clear React Query cache (in-memory + persisted).
  try { queryClient.clear(); await persister.removeClient(); } catch { /* ignore */ }

  // 4. Clear Dexie domain tables + user-scoped meta keys.
  try {
    await db.transaction(
      'rw',
      [db.patients, db.appointments, db.encounters, db.doctors, db.queue, db.meta,
       db.medicines, db.labTests, db.organization, db.branches, db.encounterHeaders],
      async () => {
        await db.patients.clear();
        await db.appointments.clear();
        await db.encounters.clear();
        await db.doctors.clear();
        await db.queue.clear();
        await db.medicines.clear();
        await db.labTests.clear();
        await db.organization.clear();
        await db.branches.clear();
        await db.encounterHeaders.clear();

        const keys = await db.meta.toCollection().primaryKeys();
        for (const k of keys) {
          if (k === 'device_id') continue;
          await db.meta.delete(k);
        }
      },
    );
  } catch { /* best effort */ }
}

export async function safeLogout(): Promise<boolean> {
  const pending = await syncQueue.countPending();
  if (pending > 0) return false;
  await clearLocalSession();
  return true;
}