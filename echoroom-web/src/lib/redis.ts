import { Redis } from "@upstash/redis";
import { env } from "./env";

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
  console.warn("Redis unavailable — rate limiting disabled");
}

export { redis };
