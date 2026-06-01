import { redis } from "@/lib/redis";
import { createLogger } from "@/server/lib/logger";

const log = createLogger("scenario-cache");
const CACHE_TTL_S = 60;
const CACHE_TRENDING_TTL_S = 120;
const CACHE_PREFIX = "cache:feed:";
const VERSION_KEY = "cache:feed:version";

export interface FeedCacheParams {
  sort: string;
  limit: number;
  cursor?: string;
}

async function getCacheVersion(): Promise<number> {
  if (!redis) return 0;
  try {
    return (await redis.get<number>(VERSION_KEY)) ?? 0;
  } catch {
    return 0;
  }
}

export async function invalidateFeedCache(): Promise<void> {
  if (!redis) return;
  try {
    await redis.incr(VERSION_KEY);
    await redis.expire(VERSION_KEY, 3600);
  } catch (error) {
    log.warn("Cache invalidation failed", { error });
  }
}

export function buildCacheKey(params: FeedCacheParams, version: number): string {
  const cursor = params.cursor ?? "first";
  return `${CACHE_PREFIX}v${version}:${params.sort}:${params.limit}:${cursor}`;
}

export async function getCachedFeed<T>(params: FeedCacheParams): Promise<T | null> {
  if (!redis) return null;
  try {
    const version = await getCacheVersion();
    const key = buildCacheKey(params, version);
    const cached = await redis.get<T>(key);
    return cached ?? null;
  } catch (error) {
    log.warn("Cache read failed", { error });
    return null;
  }
}

export async function setCachedFeed<T>(params: FeedCacheParams, data: T): Promise<void> {
  if (!redis) return;
  try {
    const version = await getCacheVersion();
    const key = buildCacheKey(params, version);
    await redis.set(key, JSON.stringify(data), { ex: CACHE_TTL_S });
  } catch (error) {
    log.warn("Cache write failed", { error });
  }
}

/** Build a cache key for the trending feed (separate prefix from regular feed). */
function buildTrendingCacheKey(
  params: Pick<FeedCacheParams, "limit" | "cursor">,
  version: number,
): string {
  const cursor = params.cursor ?? "first";
  return `cache:trending:v${version}:${params.limit}:${cursor}`;
}

export async function getCachedTrendingFeed<T>(
  params: Pick<FeedCacheParams, "limit" | "cursor">,
): Promise<T | null> {
  if (!redis) return null;
  try {
    const version = await getCacheVersion();
    const key = buildTrendingCacheKey(params, version);
    const cached = await redis.get<T>(key);
    return cached ?? null;
  } catch (error) {
    log.warn("Trending cache read failed", { error });
    return null;
  }
}

export async function setCachedTrendingFeed<T>(
  params: Pick<FeedCacheParams, "limit" | "cursor">,
  data: T,
): Promise<void> {
  if (!redis) return;
  try {
    const version = await getCacheVersion();
    const key = buildTrendingCacheKey(params, version);
    await redis.set(key, JSON.stringify(data), { ex: CACHE_TRENDING_TTL_S });
  } catch (error) {
    log.warn("Trending cache write failed", { error });
  }
}
