import { redis } from "@/lib/redis";
import { createLogger } from "@/server/lib/logger";

const log = createLogger("character-cache");
const CACHE_TTL_S = 60;
const CACHE_PREFIX = "cache:characters:";
const VERSION_KEY = "cache:characters:version";

export interface CharacterCacheParams {
  category?: string;
}

async function getCacheVersion(): Promise<number> {
  if (!redis) return 0;
  try {
    return (await redis.get<number>(VERSION_KEY)) ?? 0;
  } catch {
    return 0;
  }
}

export async function invalidateCharacterCache(): Promise<void> {
  if (!redis) return;
  try {
    await redis.incr(VERSION_KEY);
    await redis.expire(VERSION_KEY, 3600);
  } catch (error) {
    log.warn("Character cache invalidation failed", { error });
  }
}

function buildCacheKey(params: CharacterCacheParams, version: number): string {
  const category = params.category ?? "all";
  return `${CACHE_PREFIX}v${version}:${category}`;
}

export async function getCachedCharacters<T>(params?: CharacterCacheParams): Promise<T | null> {
  if (!redis) return null;
  try {
    const version = await getCacheVersion();
    const key = buildCacheKey(params ?? {}, version);
    const cached = await redis.get<T>(key);
    return cached ?? null;
  } catch (error) {
    log.warn("Character cache read failed", { error });
    return null;
  }
}

export async function setCachedCharacters<T>(data: T, params?: CharacterCacheParams): Promise<void> {
  if (!redis) return;
  try {
    const version = await getCacheVersion();
    const key = buildCacheKey(params ?? {}, version);
    await redis.set(key, JSON.stringify(data), { ex: CACHE_TTL_S });
  } catch (error) {
    log.warn("Character cache write failed", { error });
  }
}
