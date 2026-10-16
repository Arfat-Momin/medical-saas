/**
 * dataService.ts — Cloud-first read path with IndexedDB fallback.
 *
 * Usage:
 *   import { readData } from '@/lib/dataService';
 *
 *   const data = await readData(
 *     () => api.get('/departments'),          // online: direct API call
 *     () => db.departments.toArray(),          // offline: IndexedDB fallback
 *     'departments',                          // cache key (optional)
 *     30_000,                                 // cache TTL ms (optional, default 30s)
 *   );
 *
 * Online path:
 *   → memCache hit? return cached value
 *   → api call → cache result → return
 *   → network error? fall back to offline query
 *
 * Offline path:
 *   → IndexedDB query
 */

import { memCache } from './memCache';

export function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/** Marker interface for offline/network errors that allow IDB fallback. */
function isNetworkError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const err = e as any;
  // fetch errors, supabase offline, custom api wrapper flag
  return (
    err.isOffline === true ||
    err.message === 'Failed to fetch' ||
    err.message === 'Network request failed' ||
    err.code === 'NETWORK_ERROR' ||
    (err.status === undefined && err.code === undefined && err.message?.includes('fetch'))
  );
}

const DEFAULT_TTL = 30_000; // 30 seconds

export async function readData<T>(
  onlineQuery: () => Promise<T>,
  offlineQuery: () => Promise<T>,
  cacheKey?: string,
  cacheTtl: number = DEFAULT_TTL,
): Promise<T> {
  // 1. Memory cache hit
  if (cacheKey) {
    const cached = memCache.get<T>(cacheKey);
    if (cached !== null) return cached;
  }

  // 2. Online → direct API
  if (isOnline()) {
    try {
      const result = await onlineQuery();
      if (cacheKey) memCache.set(cacheKey, result, cacheTtl);
      return result;
    } catch (e: unknown) {
      if (isNetworkError(e)) {
        // Network flap: silently fall through to offline
        console.warn('[dataService] Network error, falling back to IndexedDB:', e);
        return offlineQuery();
      }
      // Any other error (4xx, 5xx, validation) → re-throw
      throw e;
    }
  }

  // 3. Offline → IndexedDB
  return offlineQuery();
}

/**
 * Convenience: write path helper.
 * When online, writes directly to API and updates local cache.
 * When offline, writes to local store and queues for sync.
 */
export async function writeData<T>(
  onlineWrite: () => Promise<T>,
  offlineWrite: () => Promise<T>,
  invalidateCacheKeys?: string[],
): Promise<T> {
  let result: T;
  if (isOnline()) {
    try {
      result = await onlineWrite();
    } catch (e: unknown) {
      if (isNetworkError(e)) {
        result = await offlineWrite();
      } else {
        throw e;
      }
    }
  } else {
    result = await offlineWrite();
  }

  // Bust any stale cache entries related to this write
  if (invalidateCacheKeys) {
    for (const key of invalidateCacheKeys) {
      memCache.invalidate(key);
    }
  }

  return result;
}
