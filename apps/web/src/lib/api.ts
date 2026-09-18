import { useAuthStore } from '@/stores/auth.store';
import { clearLocalSession } from '@/lib/session';

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
  // Instant offline detection - never wait for the browser's default
  // timeout when the OS says we're offline.
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

  // Timeout guard - flaky networks shouldn't freeze the UI forever.
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

  // 401: session expired or revoked. Wipe ALL user-scoped local data
  // before redirecting to /login, otherwise the next user on this
  // device would see the previous user's cached patients/appointments.
  // Retry-once on 401: Supabase's auth.getUser can transiently fail.
  // Only log the user out if two consecutive attempts fail.
  if (res.status === 401 && token && !opts.skipAuthRedirect) {
    // One retry to survive a transient Supabase hiccup. If the second
    // attempt also 401s, we're sure the token is dead and can log out.
    try {
      const retry = await fetch(`${API_URL}${path}`, {
        ...init,
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (retry.ok) {
        const body = await retry.json().catch(() => ({} as any));
        return body as T;
      }
    } catch {
      /* fall through to logout */
    }

    try {
      await clearLocalSession();
    } catch {
      /* best effort - still redirect below */
    }
    if (window.location.pathname !== '/login') {
      window.location.replace('/login');
    }
    throw new ApiError(401, 'UNAUTHORIZED', 'Session expired');
  }

  // Detect non-JSON responses. During a Render free-tier cold start, the
  // platform returns an HTML loading page with status 200. Without this
  // guard, JSON.parse would silently fall back to {} and the query would
  // resolve "successfully" with garbage data.
  const ctype = res.headers.get('content-type') ?? '';
  if (res.ok && !ctype.includes('application/json')) {
    throw new ApiError(
      0,
      'COLD_START',
      'The server is starting up. Please retry in a moment.',
    );
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