import { api } from '@/lib/api';
import { getDeviceId } from '@/db';
import { useAuthStore } from '@/stores/auth.store';

let registered = false;

export async function registerDeviceIfNeeded(): Promise<void> {
  if (registered) return;
  const token = useAuthStore.getState().accessToken;
  if (!token) return;

  try {
    const deviceId = await getDeviceId();
    await api.post('/sync/devices', {
      deviceId,
      platform: 'web',
      appVersion: '0.1.0',
      osVersion: navigator.userAgent.slice(0, 100),
    });
    registered = true;
  } catch {
    // offline - retry later
  }
}

export function resetRegistration() {
  registered = false;
}
