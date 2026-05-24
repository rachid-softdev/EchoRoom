import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";
import { TRPCError } from "@trpc/server";

let redis: Redis | null = null;
try {
  if (env.REDIS_URL) {
    const url = new URL(env.REDIS_URL);
    redis = new Redis({
      url: env.REDIS_URL,
      token: url.password || "",
    });
  }
} catch {
  // Rate limiting disabled
}

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
      console.warn("[RateLimit] Redis unavailable — rate limiting disabled");
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
