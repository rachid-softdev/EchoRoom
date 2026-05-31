import { createLogger } from "@/server/lib/logger";

const log = createLogger("rate-limit-store");

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Per-process in-memory rate limit store.
 * Used ONLY as a degraded fallback when Redis is unavailable.
 *
 * NOTE: In multi-instance deployments, effective rate limits are
 * multiplied by the instance count. This is acceptable only as a
 * degraded-mode fallback. Primary rate limiting MUST use Redis.
 */
class InMemoryRateLimitStore {
  private store = new Map<string, RateLimitEntry>();
  private lastCleanup = Date.now();
  private readonly CLEANUP_INTERVAL_MS = 30_000;

  /**
   * Checks and increments the counter for a given key.
   * Returns true if the request is allowed, false if rate limited.
   */
  check(key: string, limit: number, windowSec: number): boolean {
    const now = Date.now();
    this.periodicCleanup(now);

    const entry = this.store.get(key);

    if (!entry || entry.resetAt <= now) {
      // Delete expired entry before creating a new one
      if (entry && entry.resetAt <= now) {
        this.store.delete(key);
      }
      // Nouvelle fenêtre alignée sur l'horloge (comportement déterministe)
      const windowStart = now - (now % (windowSec * 1000));
      this.store.set(key, {
        count: 1,
        resetAt: windowStart + windowSec * 1000,
      });
      return true;
    }

    if (entry.count >= limit) {
      return false;
    }

    entry.count++;
    return true;
  }

  private periodicCleanup(now: number): void {
    if (now - this.lastCleanup < this.CLEANUP_INTERVAL_MS) return;
    this.lastCleanup = now;

    // Delete expired entries
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt <= now) {
        this.store.delete(key);
      }
    }

    // If store is too large, evict oldest 25% of entries
    if (this.store.size > 100_000) {
      const sorted = [...this.store.entries()].sort(([, a], [, b]) => a.resetAt - b.resetAt);
      const toDelete = Math.floor(sorted.length * 0.25);
      for (let i = 0; i < toDelete; i++) {
        this.store.delete(sorted[i][0]);
      }
      log.warn("In-memory rate limit store evicted 25% of entries", {
        remaining: this.store.size,
      });
    }
  }

  /** For testing purposes */
  get size(): number {
    return this.store.size;
  }
}

export const inMemoryRateLimitStore = new InMemoryRateLimitStore();
