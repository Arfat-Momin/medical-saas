import { useAuthStore } from '@/stores/auth.store';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

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
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  // Auto-logout only if we WERE authenticated and the server rejected us.
  // Login itself has no token, so a failed login won't trigger a redirect loop.
  if (res.status === 401 && token) {
    useAuthStore.getState().logout();
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
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
  post:   <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  patch:  <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  delete: <T>(path: string)                 => apiRequest<T>(path, { method: 'DELETE' }),
};