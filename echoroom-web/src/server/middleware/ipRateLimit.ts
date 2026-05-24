import { TRPCError } from "@trpc/server";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";
import { middleware } from "../trpc";

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
  // IP rate limiting disabled
}

let warnLogged = false;

export function withIPRateLimit(config: { limit: number; window: number }) {
  return middleware(async ({ ctx, next, path }) => {
    if (!redis) {
      if (!warnLogged) {
        console.warn("[IP RateLimit] Redis unavailable — IP rate limiting disabled");
        warnLogged = true;
      }
      return next({ ctx });
    }

    const ip =
      ctx.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      ctx.headers?.get("x-real-ip") ??
      "unknown";

    const key = `iplimit:${path}:${ip}`;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - config.window;

    const count = await redis.zcount(key, windowStart, now);
    if (count >= config.limit) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Trop de requêtes. Veuillez réessayer plus tard.",
      });
    }

    await redis.zadd(key, {
      score: now,
      member: `${ip}:${now}:${Math.random().toString(36).substring(2, 10)}`,
    });
    await redis.expire(key, config.window);

    return next({ ctx });
  });
}
