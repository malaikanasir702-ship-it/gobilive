/**
 * cache.service.ts
 *
 * Lightweight in-process TTL cache — zero external dependencies.
 *
 * Purpose:
 *  - Caches frequently read, rarely mutated data (gift catalog, leaderboard,
 *    discovery feed) to avoid hammering MongoDB on every request.
 *  - Safe for a single Railway instance. If you later scale to multiple
 *    instances, swap the store with a Redis client while keeping the same API.
 *
 * Usage:
 *  import { AppCache } from '../../core/services/cache.service';
 *
 *  // Write
 *  AppCache.set('gifts:catalog', data, 60);          // TTL 60 seconds
 *
 *  // Read
 *  const cached = AppCache.get<GiftDoc[]>('gifts:catalog');
 *
 *  // Invalidate
 *  AppCache.del('gifts:catalog');
 *  AppCache.delPattern('gifts:');                     // wildcard delete
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // ms since epoch
}

class InMemoryCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  // ── Write ────────────────────────────────────────────────────────────────

  /**
   * Store a value with a TTL.
   * @param key    Cache key
   * @param value  Value to store (any JSON-serialisable type)
   * @param ttlSec Time-to-live in seconds (default 30)
   */
  set<T>(key: string, value: T, ttlSec = 30): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSec * 1000,
    });
  }

  // ── Read ─────────────────────────────────────────────────────────────────

  /**
   * Retrieve a cached value.
   * Returns `null` if the key does not exist or has expired.
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  // ── Delete ───────────────────────────────────────────────────────────────

  del(key: string): void {
    this.store.delete(key);
  }

  /**
   * Delete all keys that start with the given prefix.
   * Useful for namespace-level invalidation (e.g. `delPattern('user:')`).
   */
  delPattern(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  // ── Utility ──────────────────────────────────────────────────────────────

  size(): number {
    return this.store.size;
  }

  /** Purge all expired entries — called by the housekeeping cron. */
  purgeExpired(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        removed++;
      }
    }
    return removed;
  }

  flush(): void {
    this.store.clear();
  }
}

/** Singleton cache instance used across the entire app. */
export const AppCache = new InMemoryCache();

// ─────────────────────────────────────────────
// Cache stampede / thundering-herd protection
// ─────────────────────────────────────────────
// When cache is empty and 500 requests arrive simultaneously, all of them
// would fire DB queries at once (thundering herd). This map holds in-flight
// promises so only ONE DB query runs; all others await the same result.
const _inflightMap = new Map<string, Promise<unknown>>();

/**
 * Read from cache, or call `loader()` exactly once even under concurrent load.
 *
 * @param key     Cache key
 * @param loader  Async function that fetches the data (called at most once)
 * @param ttlSec  TTL for the cached value (default 30s)
 */
export async function cacheGetOrLoad<T>(
  key: string,
  loader: () => Promise<T>,
  ttlSec = 30
): Promise<T> {
  // 1. Cache hit
  const hit = AppCache.get<T>(key);
  if (hit !== null) return hit;

  // 2. Another request already loading — piggyback on it
  if (_inflightMap.has(key)) {
    return _inflightMap.get(key) as Promise<T>;
  }

  // 3. First request — run loader, cache result, resolve all waiters
  const promise = loader().then((value) => {
    AppCache.set(key, value, ttlSec);
    _inflightMap.delete(key);
    return value;
  }).catch((err) => {
    _inflightMap.delete(key); // on error, let next request retry
    throw err;
  });

  _inflightMap.set(key, promise);
  return promise;
}

// Auto-purge expired entries every 5 minutes so RAM doesn't creep up
setInterval(() => {
  const removed = AppCache.purgeExpired();
  if (removed > 0) {
    console.debug(`[Cache] Purged ${removed} expired entries`);
  }
}, 5 * 60 * 1000);
