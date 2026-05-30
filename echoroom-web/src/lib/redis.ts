import { Redis } from "@upstash/redis";
import { env } from "./env";
import { createLogger } from "@/server/lib/logger";

const log = createLogger("redis");

let redis: Redis | null = null;

try {
  if (env.REDIS_URL) {
    let url;
    try {
      url = new URL(env.REDIS_URL);
    } catch {
      log.error("REDIS_URL is malformed — Redis unavailable");
      throw new Error("Invalid REDIS_URL");
    }

    redis = new Redis({
      url: env.REDIS_URL,
      token: url.password || undefined,
    });
  }
} catch {
  log.warn("Redis unavailable — rate limiting using in-memory fallback");
}

export { redis };
