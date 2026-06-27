import { TRPCError } from "@trpc/server";
import { redis } from "@/lib/redis";
import { createLogger } from "@/server/lib/logger";
import { inMemoryRateLimitStore } from "./rateLimitStore";

const log = createLogger("rate-limit");

interface RateLimitConfig {
  identifier: string;
  limit: number;
  window: number;
}

let redisUnavailableLogged = false;

export async function checkRateLimit({
  identifier,
  limit,
  window: windowSec,
}: RateLimitConfig): Promise<void> {
  const key = `ratelimit:${identifier}`;

  // Try Redis first (with try/catch for graceful fallback)
  if (redis) {
    try {
      const now = Math.floor(Date.now() / 1000);
      const windowStart = now - windowSec;

      const count = await redis.zcount(key, windowStart, now);
      if (count >= limit) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Trop de requêtes. Veuillez réessayer plus tard.",
        });
      }

      await redis.zadd(key, {
        score: now,
        member: `${identifier}:${now}:${Math.random().toString(36).substring(2, 10)}`,
      });
      await redis.expire(key, windowSec);
      return;
    } catch (error) {
      // Re-throw TRPCError directly (actual rate limit hit, not a Redis failure)
      if (error instanceof TRPCError) throw error;

      if (!redisUnavailableLogged) {
        log.error("Redis rate limit failed — falling back to in-memory", {
          error: error instanceof Error ? error.message : String(error),
        });
        redisUnavailableLogged = true;
      }
    }
  } else if (!redisUnavailableLogged) {
    log.warn("Redis unavailable — using in-memory rate limiting fallback");
    redisUnavailableLogged = true;
  }

  // In-memory fallback (fail CLOSED: if store denies, throw)
  const allowed = inMemoryRateLimitStore.check(key, limit, windowSec);
  if (!allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Trop de requêtes. Veuillez réessayer plus tard.",
    });
  }
}
