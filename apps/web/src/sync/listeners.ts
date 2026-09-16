import { useAuthStore } from '@/stores/auth.store';
import { syncEngine } from './engine';
import { syncQueue } from './queue';
import { getDeviceId } from '@/db';
import { api } from '@/lib/api';

import { queryClient } from '@/lib/queryClient';
let deviceRegistered = false;
let syncInterval: ReturnType<typeof setInterval> | null = null;
let stopSyncLoop: (() => void) | null = null;

async function registerDevice() {
  if (deviceRegistered) return;
  if (!useAuthStore.getState().accessToken) return;
  try {
    const deviceId = await getDeviceId();
    await api.post('/sync/devices', {
      deviceId,
      platform: 'web',
      appVersion: '0.1.0',
      osVersion: navigator.userAgent.slice(0, 50),
    });
    deviceRegistered = true;
  } catch {
    /* best effort */
  }
}

export function startWebSyncListeners(): () => void {
  // ── Tenant watcher ──────────────────────────────────────────────────
  // Fresh login: token lands in the store before /auth/me resolves, so
  // the very first sync ran with tenantId === null and no-op'd. This
  // subscription fires sync exactly once when tenantId becomes non-null.
  let tenantSyncFired = false;
  useAuthStore.subscribe((state, prev) => {
    if (
      !tenantSyncFired &&
      state.tenantId &&
      state.tenantId !== prev?.tenantId &&
      state.accessToken
    ) {
      tenantSyncFired = true;
      void (async () => {
        try {
          const r = await syncEngine.sync().then((r) => { queryClient.invalidateQueries(); return r; });
          console.log(
            `[sync] tenant-ready - pushed ${r.pushed}, pulled ${r.pulled}, failed ${r.failed}`,
          );
        } catch (e: any) {
          console.log('[sync] tenant-ready failed:', e?.message ?? e);
        }
      })();
    }
  });
  if (stopSyncLoop) return stopSyncLoop;

  (async () => {
    if (!useAuthStore.getState().accessToken) return;
    try {
      await registerDevice();
      const s = await syncEngine.sync().then((r) => { queryClient.invalidateQueries(); return r; });
      console.log(`[sync] initial - pushed ${s.pushed}, pulled ${s.pulled}, failed ${s.failed}`);
    } catch (e: any) {
      console.log('[sync] initial failed:', e?.message ?? e);
    }
  })();

  async function handleOnline() {
    if (!useAuthStore.getState().accessToken) return;
    console.log('[sync] back online');
    await registerDevice();
    await syncEngine.sync().then((r) => { queryClient.invalidateQueries(); return r; });
  }

  function handleOffline() {
    console.log('[sync] offline');
  }

  function handleVisibility() {
    if (document.visibilityState === 'visible' && useAuthStore.getState().accessToken) {
      void syncEngine.pull();
    }
  }

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  document.addEventListener('visibilitychange', handleVisibility);

  syncInterval = setInterval(async () => {
    if (!useAuthStore.getState().accessToken) return;
    const pending = await syncQueue.countPending();
    if (pending === 0) return;
    await registerDevice();
    await syncEngine.sync().then((r) => { queryClient.invalidateQueries(); return r; });
  }, 20_000);

  stopSyncLoop = () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    document.removeEventListener('visibilitychange', handleVisibility);
    if (syncInterval) clearInterval(syncInterval);
    syncInterval = null;
    stopSyncLoop = null;
  };

  return stopSyncLoop;
}

export async function triggerSyncNow(options?: { full?: boolean }) {
  await registerDevice();
  if (options?.full) {
    const { meta } = await import('@/db');
    await meta.set('last_pull_at', '');
    await meta.set('last_pull_appt_at', '');
    await meta.set('last_pull_doc_at', '');
  }
  await syncQueue.retryFailed();
  return syncEngine.sync();
}