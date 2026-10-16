/**
 * Simple in-memory TTL cache.
 * Used by dataService.ts to avoid redundant network calls for
 * reference data (doctors, departments, branches, medicines, lab tests).
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

/** Singleton cache shared across the whole app. */
export const memCache = new MemCache();
