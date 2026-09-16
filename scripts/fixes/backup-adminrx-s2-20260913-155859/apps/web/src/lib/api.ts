import { useAuthStore } from '@/stores/auth.store';

const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1';
const REQUEST_TIMEOUT_MS = 8_000;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isOffline(): boolean {
    return this.status === 0 || this.code === 'NETWORK_ERROR';
  }
}

export interface RequestOptions {
  expectedUpdatedAt?: string | null;
  idempotencyKey?: string;
  deviceId?: string;
  skipAuthRedirect?: boolean;
}

async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  opts: RequestOptions = {},
): Promise<T> {
  //  INSTANT OFFLINE DETECTION 
  // Never wait for the browser's default timeout when the OS says we're
  // offline. Throw immediately so React Query and the sync engine can
  // fall back to IndexedDB without a 30-second stall.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiError(0, 'NETWORK_ERROR', 'You are offline.');
  }

  const token = useAuthStore.getState().accessToken;
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (opts.expectedUpdatedAt) headers.set('X-Expected-Updated-At', opts.expectedUpdatedAt);
  if (opts.idempotencyKey) headers.set('X-Idempotency-Key', opts.idempotencyKey);
  if (opts.deviceId) headers.set('X-Device-Id', opts.deviceId);

  //  TIMEOUT GUARD 
  // Even if navigator.onLine is true, a flaky network can hang. Abort
  // after 8s so the UI never freezes forever.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new ApiError(0, 'NETWORK_ERROR', 'Request timed out. Check your connection.');
    }
    throw new ApiError(0, 'NETWORK_ERROR', 'Network request failed.');
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 401 && token && !opts.skipAuthRedirect) {
    useAuthStore.getState().logout();
    if (window.location.pathname !== '/login') window.location.href = '/login';
    throw new ApiError(401, 'UNAUTHORIZED', 'Session expired');
  }

  const data = await res.json().catch(() => ({} as any));

  if (!res.ok) {
    const err = data?.error ?? { code: 'UNKNOWN', message: res.statusText };
    throw new ApiError(res.status, err.code, err.message, err.details);
  }

  return data as T;
}

export const api = {
  get:    <T>(path: string)                 => apiRequest<T>(path),
  post:   <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiRequest<T>(path, { method: 'POST',   body: JSON.stringify(body) }, opts),
  patch:  <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiRequest<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }, opts),
  put:    <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiRequest<T>(path, { method: 'PUT',    body: JSON.stringify(body) }, opts),
  delete: <T>(path: string, opts?: RequestOptions) =>
    apiRequest<T>(path, { method: 'DELETE' }, opts),
};
