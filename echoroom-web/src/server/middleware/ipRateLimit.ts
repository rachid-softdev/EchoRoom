import { redis } from "@/lib/redis";
import { TRPCError } from "@trpc/server";
import { middleware } from "../trpc";
import { createLogger } from "@/server/lib/logger";

const log = createLogger("ip-rate-limit");

let warnLogged = false;

export function withIPRateLimit(config: { limit: number; window: number }) {
  return middleware(async ({ ctx, next, path }) => {
    if (!redis) {
      if (!warnLogged) {
        log.warn("Redis unavailable — IP rate limiting disabled");
        warnLogged = true;
      }
      return next();
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

    return next();
  });
}
