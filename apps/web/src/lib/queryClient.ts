import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

/**
 * React Query client tuned for offline-first behavior:
 *
 * - `networkMode: 'offlineFirst'` - when offline, queries resolve from cache
 *   immediately instead of throwing.
 * - `retry: 1` - one retry on transient errors, then give up.
 * - `refetchOnReconnect: true` - when we come back online, refetch everything.
 * - `gcTime: 7 days` - cache persists for 7 days.
 *
 * The cache itself is persisted to localStorage (see `persister` below).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst',
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
      retry: (failureCount, error: any) => {
        // Don't retry 4xx client errors, but retry network failures once
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: 1,
    },
  },
});

/**
 * Persist the React Query cache to localStorage so it survives page reloads
 * and offline sessions. Key: `medsaas_rq_cache`.
 */
export const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'medsaas_rq_cache',
  throttleTime: 1000,
});
