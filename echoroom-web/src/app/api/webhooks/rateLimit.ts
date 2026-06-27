import { redis } from "@/lib/redis";
import { createLogger } from "@/server/lib/logger";
import { inMemoryRateLimitStore } from "@/server/middleware/rateLimitStore";

const log = createLogger("webhook-ratelimit");

export interface WebhookRateLimitConfig {
  /** Maximum requests in the window */
  limit: number;
  /** Window duration in seconds */
  windowSec: number;
  /** Whether to key by request IP (true) or provider globally (false) */
  perIp: boolean;
}

export const WEBHOOK_RATE_LIMITS: Record<string, WebhookRateLimitConfig> = {
  "twilio:status": { limit: 60, windowSec: 60, perIp: false },
  "twilio:voice:init": { limit: 30, windowSec: 60, perIp: true },
  "twilio:voice:input": { limit: 60, windowSec: 60, perIp: true },
  "twilio:voice:stream": { limit: 30, windowSec: 60, perIp: true },
  "stripe:checkout": { limit: 20, windowSec: 60, perIp: false },
};

/**
 * Shared webhook rate limiter.
 * Uses Redis sorted sets (sliding window) with in-memory fallback.
 */
export async function checkWebhookRateLimit(endpointKey: string, ip: string): Promise<boolean> {
  const config = WEBHOOK_RATE_LIMITS[endpointKey];
  if (!config) {
    log.warn("Unknown webhook endpoint key, denying", { endpointKey });
    return false; // Unknown endpoints: deny (sécurité maximale)
  }

  const now = Date.now();
  const windowMs = config.windowSec * 1000;

  // Build the rate limit key
  const key = config.perIp ? `webhook:${endpointKey}:${ip}` : `webhook:${endpointKey}`;

  // Try Redis first
  if (redis) {
    try {
      // Remove expired entries
      await redis.zremrangebyscore(key, 0, now - windowMs);

      // Count requests in window
      const count = await redis.zcard(key);

      if (count >= config.limit) {
        return false; // Rate limited
      }

      // Record this request
      await redis.zadd(key, {
        score: now,
        member: `${now}:${Math.random().toString(36).slice(2, 8)}`,
      });
      await redis.expire(key, config.windowSec);

      return true;
    } catch (error) {
      log.error("Redis rate limit failed — falling back to in-memory", { error });
      // Fall through to in-memory fallback
    }
  }

  // In-memory fallback using the existing rate limit store
  // Align with Redis key strategy: respect config.perIp
  const inMemKey = config.perIp ? `${endpointKey}:${ip}` : endpointKey;
  return inMemoryRateLimitStore.check(inMemKey, config.limit, config.windowSec);
}
