import { syncEngine } from './engine';
import { registerDeviceIfNeeded } from './register';
import { syncQueue } from './queue';
import { useAuthStore } from '@/stores/auth.store';

let started = false;
let interval: ReturnType<typeof setInterval> | null = null;

const PERIODIC_MS = 20_000;

export function startWebSyncListeners(): () => void {
  if (started) return () => {};
  started = true;

  //  1. Full sync immediately on mount (not just on login) 
  void (async () => {
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      console.log('[sync] no token - skipping initial sync');
      return;
    }
    try {
      console.log('[sync] initial sync starting...');
      await registerDeviceIfNeeded();
      // Clear pull pointers to force a full pull on first load
      const { meta } = await import('@/db');
      await meta.set('last_pull_at', '');
      const r = await syncEngine.sync();
      console.log(`[sync] initial complete - pushed ${r.pushed}, pulled ${r.pulled}, failed ${r.failed}`);
    } catch (e: any) {
      console.log('[sync] initial failed:', e?.message ?? e);
    }
  })();

  //  2. Network transition 
  const onOnline = async () => {
    const token = useAuthStore.getState().accessToken;
    if (!token) return;
    console.log('[sync] back online');
    await registerDeviceIfNeeded();
    await syncEngine.sync();
  };
  const onOffline = () => console.log('[sync] offline');

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  //  3. Tab visibility 
  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      const token = useAuthStore.getState().accessToken;
      if (token) void syncEngine.pull();
    }
  };
  document.addEventListener('visibilitychange', onVisible);

  //  4. Periodic push of pending items 
  interval = setInterval(async () => {
    const pending = await syncQueue.countPending();
    if (pending === 0) return;
    const token = useAuthStore.getState().accessToken;
    if (!token) return;
    await registerDeviceIfNeeded();
    await syncEngine.sync();
  }, PERIODIC_MS);

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisible);
    if (interval) clearInterval(interval);
    started = false;
  };
}

export async function triggerSyncNow() {
  await registerDeviceIfNeeded();
  const { meta } = await import('@/db');
  await meta.set('last_pull_at', '');
  return syncEngine.sync();
}
