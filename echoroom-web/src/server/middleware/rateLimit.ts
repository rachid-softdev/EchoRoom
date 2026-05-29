import { redis } from "@/lib/redis";
import { TRPCError } from "@trpc/server";
import { createLogger } from "@/server/lib/logger";

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
    if (!redisUnavailableLogged) {
      log.warn("Redis unavailable — rate limiting disabled");
      redisUnavailableLogged = true;
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
