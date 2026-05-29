import { redis } from "@/lib/redis";
import { TRPCError } from "@trpc/server";
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
  if (!redis) {
    // Fallback in-memory rate limiting when Redis is unavailable
    if (!redisUnavailableLogged) {
      log.warn("Redis unavailable — using in-memory rate limiting fallback");
      redisUnavailableLogged = true;
    }
    const allowed = inMemoryRateLimitStore.check(
      `ratelimit:${identifier}`,
      limit,
      windowSec,
    );
    if (!allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Trop de requêtes. Veuillez réessayer plus tard.",
      });
    }
    return;
  }

  const key = `ratelimit:${identifier}`;
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
}
