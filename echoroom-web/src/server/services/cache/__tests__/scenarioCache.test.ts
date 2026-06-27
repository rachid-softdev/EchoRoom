import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Scenario Cache Tests
// ---------------------------------------------------------------------------
// Tests for scenarioCache.ts:
//   - Graceful degradation when redis is null
//   - getCachedFeed calls redis.get with correct key
//   - setCachedFeed calls redis.set with correct key and TTL
//   - invalidateFeedCache increments version and sets expiry
//   - buildCacheKey generates correct keys

const mockLogInstance = {
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => mockLogInstance),
}));

// Persistent redis mock object — tests clear and configure methods via these refs
const mockRedisInstance = {
  get: vi.fn(),
  set: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
};

vi.mock("@/lib/redis", () => ({
  redis: mockRedisInstance,
}));

describe("scenarioCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // No cleanup needed — vi.clearAllMocks handles it
  });

  // -----------------------------------------------------------------------
  // getCachedFeed
  // -----------------------------------------------------------------------

  it("should call redis.get with correct key format", async () => {
    mockRedisInstance.get
      .mockResolvedValueOnce(5) // getCacheVersion returns 5
      .mockResolvedValueOnce({ items: [1, 2, 3] }); // cached data

    const { getCachedFeed } = await import("../scenarioCache");

    const result = await getCachedFeed({ sort: "recent", limit: 20, cursor: "abc" });

    expect(result).toEqual({ items: [1, 2, 3] });
    expect(mockRedisInstance.get).toHaveBeenCalledTimes(2);
    expect(mockRedisInstance.get).toHaveBeenNthCalledWith(1, "cache:feed:version");
    expect(mockRedisInstance.get).toHaveBeenNthCalledWith(2, "cache:feed:v5:recent:20:abc");
  });

  it("should return null when cache miss", async () => {
    mockRedisInstance.get
      .mockResolvedValueOnce(3) // version
      .mockResolvedValueOnce(null); // cache miss

    const { getCachedFeed } = await import("../scenarioCache");

    const result = await getCachedFeed({ sort: "popular", limit: 5 });

    expect(result).toBeNull();
  });

  it("should use 'first' as cursor when cursor is undefined", async () => {
    mockRedisInstance.get
      .mockResolvedValueOnce(1) // version
      .mockResolvedValueOnce("data"); // cached data

    const { getCachedFeed } = await import("../scenarioCache");

    await getCachedFeed({ sort: "recent", limit: 10 });

    // Key should use 'first' for undefined cursor
    expect(mockRedisInstance.get).toHaveBeenNthCalledWith(2, "cache:feed:v1:recent:10:first");
  });

  it("should return null on redis error without crashing", async () => {
    mockRedisInstance.get.mockRejectedValue(new Error("Redis connection failed"));

    const { getCachedFeed } = await import("../scenarioCache");

    const result = await getCachedFeed({ sort: "recent", limit: 10 });
    expect(result).toBeNull();

    expect(mockLogInstance.warn).toHaveBeenCalledWith("Cache read failed", expect.any(Object));
  });

  // -----------------------------------------------------------------------
  // setCachedFeed
  // -----------------------------------------------------------------------

  it("should call redis.set with correct key and TTL", async () => {
    mockRedisInstance.get.mockResolvedValue(2); // version
    mockRedisInstance.set.mockResolvedValue("OK");

    const { setCachedFeed } = await import("../scenarioCache");

    const data = { items: ["a", "b"] };
    await setCachedFeed({ sort: "recent", limit: 10, cursor: "xyz" }, data);

    expect(mockRedisInstance.get).toHaveBeenCalledWith("cache:feed:version");
    expect(mockRedisInstance.set).toHaveBeenCalledWith(
      "cache:feed:v2:recent:10:xyz",
      JSON.stringify(data),
      { ex: 60 }, // CACHE_TTL_S = 60
    );
  });

  it("should handle redis error gracefully when set fails", async () => {
    mockRedisInstance.get.mockResolvedValue(1);
    mockRedisInstance.set.mockRejectedValue(new Error("Write failed"));

    const { setCachedFeed } = await import("../scenarioCache");

    await expect(setCachedFeed({ sort: "recent", limit: 10 }, { x: 1 })).resolves.toBeUndefined();

    expect(mockLogInstance.warn).toHaveBeenCalledWith("Cache write failed", expect.any(Object));
  });

  // -----------------------------------------------------------------------
  // invalidateFeedCache
  // -----------------------------------------------------------------------

  it("should increment version key and set expiry", async () => {
    mockRedisInstance.incr.mockResolvedValue(6);
    mockRedisInstance.expire.mockResolvedValue(1);

    const { invalidateFeedCache } = await import("../scenarioCache");

    await invalidateFeedCache();

    expect(mockRedisInstance.incr).toHaveBeenCalledWith("cache:feed:version");
    expect(mockRedisInstance.expire).toHaveBeenCalledWith("cache:feed:version", 3600);
  });

  it("should handle redis error gracefully when invalidate fails", async () => {
    mockRedisInstance.incr.mockRejectedValue(new Error("Incr failed"));

    const { invalidateFeedCache } = await import("../scenarioCache");

    await expect(invalidateFeedCache()).resolves.toBeUndefined();

    expect(mockLogInstance.warn).toHaveBeenCalledWith(
      "Cache invalidation failed",
      expect.any(Object),
    );
  });

  // -----------------------------------------------------------------------
  // Graceful degradation when redis = null
  // -----------------------------------------------------------------------

  it("should degrade gracefully when redis returns nothing", async () => {
    // Simulate redis unavailable by making get return undefined/resolve to null
    mockRedisInstance.get.mockResolvedValue(undefined);

    const { getCachedFeed, setCachedFeed, invalidateFeedCache } = await import("../scenarioCache");

    // getCachedFeed should return null when version is undefined
    const feed = await getCachedFeed({ sort: "recent", limit: 10 });
    expect(feed).toBeNull();

    // setCachedFeed should complete without error even if nothing is cached
    mockRedisInstance.set.mockRejectedValue(new Error("Cannot set"));
    await expect(setCachedFeed({ sort: "recent", limit: 10 }, { x: 1 })).resolves.toBeUndefined();

    // invalidateFeedCache should complete without error
    mockRedisInstance.incr.mockRejectedValue(new Error("Cannot incr"));
    await expect(invalidateFeedCache()).resolves.toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // buildCacheKey
  // -----------------------------------------------------------------------

  it("buildCacheKey should use 'first' when cursor is undefined", async () => {
    const mod = await vi.importActual<typeof import("../scenarioCache")>("../scenarioCache");

    const key1 = mod.buildCacheKey({ sort: "recent", limit: 20 }, 3);
    expect(key1).toBe("cache:feed:v3:recent:20:first");

    const key2 = mod.buildCacheKey({ sort: "recent", limit: 20, cursor: "abc" }, 3);
    expect(key2).toBe("cache:feed:v3:recent:20:abc");
  });

  it("buildCacheKey should handle different sort orders and limits", async () => {
    const mod = await vi.importActual<typeof import("../scenarioCache")>("../scenarioCache");

    const key1 = mod.buildCacheKey({ sort: "popular", limit: 5, cursor: "page1" }, 7);
    expect(key1).toBe("cache:feed:v7:popular:5:page1");

    const key2 = mod.buildCacheKey({ sort: "trending", limit: 50 }, 0);
    expect(key2).toBe("cache:feed:v0:trending:50:first");
  });

  // -----------------------------------------------------------------------
  // getCachedTrendingFeed
  // -----------------------------------------------------------------------

  it("getCachedTrendingFeed should use correct key prefix 'cache:trending:'", async () => {
    mockRedisInstance.get
      .mockResolvedValueOnce(3) // version
      .mockResolvedValueOnce({ items: ["a", "b"] }); // cached data

    const { getCachedTrendingFeed } = await import("../scenarioCache");
    const result = await getCachedTrendingFeed({ limit: 10, cursor: "page1" });

    expect(result).toEqual({ items: ["a", "b"] });
    expect(mockRedisInstance.get).toHaveBeenNthCalledWith(1, "cache:feed:version");
    expect(mockRedisInstance.get).toHaveBeenNthCalledWith(2, "cache:trending:v3:10:page1");
  });

  it("getCachedTrendingFeed should use 'first' when cursor is undefined", async () => {
    mockRedisInstance.get.mockResolvedValueOnce(2).mockResolvedValueOnce("data");

    const { getCachedTrendingFeed } = await import("../scenarioCache");
    await getCachedTrendingFeed({ limit: 20 });

    expect(mockRedisInstance.get).toHaveBeenNthCalledWith(2, "cache:trending:v2:20:first");
  });

  it("getCachedTrendingFeed should return null on cache miss", async () => {
    mockRedisInstance.get.mockResolvedValueOnce(1).mockResolvedValueOnce(null);

    const { getCachedTrendingFeed } = await import("../scenarioCache");
    const result = await getCachedTrendingFeed({ limit: 5 });

    expect(result).toBeNull();
  });

  it("getCachedTrendingFeed should return null on redis error", async () => {
    mockRedisInstance.get.mockRejectedValue(new Error("Redis error"));

    const { getCachedTrendingFeed } = await import("../scenarioCache");
    const result = await getCachedTrendingFeed({ limit: 10 });

    expect(result).toBeNull();
    expect(mockLogInstance.warn).toHaveBeenCalledWith(
      "Trending cache read failed",
      expect.any(Object),
    );
  });

  // -----------------------------------------------------------------------
  // setCachedTrendingFeed
  // -----------------------------------------------------------------------

  it("setCachedTrendingFeed should use correct key prefix and TTL of 120s", async () => {
    mockRedisInstance.get.mockResolvedValue(4); // version
    mockRedisInstance.set.mockResolvedValue("OK");

    const { setCachedTrendingFeed } = await import("../scenarioCache");
    const data = { items: ["x", "y"] };
    await setCachedTrendingFeed({ limit: 15, cursor: "abc" }, data);

    expect(mockRedisInstance.get).toHaveBeenCalledWith("cache:feed:version");
    expect(mockRedisInstance.set).toHaveBeenCalledWith(
      "cache:trending:v4:15:abc",
      JSON.stringify(data),
      { ex: 120 }, // CACHE_TRENDING_TTL_S = 120
    );
  });

  it("setCachedTrendingFeed should use 'first' when cursor is undefined", async () => {
    mockRedisInstance.get.mockResolvedValue(5);
    mockRedisInstance.set.mockResolvedValue("OK");

    const { setCachedTrendingFeed } = await import("../scenarioCache");
    await setCachedTrendingFeed({ limit: 25 }, { items: [] });

    expect(mockRedisInstance.set).toHaveBeenCalledWith(
      "cache:trending:v5:25:first",
      JSON.stringify({ items: [] }),
      { ex: 120 },
    );
  });

  it("setCachedTrendingFeed should handle redis error gracefully", async () => {
    mockRedisInstance.get.mockResolvedValue(1);
    mockRedisInstance.set.mockRejectedValue(new Error("Write failed"));

    const { setCachedTrendingFeed } = await import("../scenarioCache");
    await expect(setCachedTrendingFeed({ limit: 10 }, { items: [] })).resolves.toBeUndefined();

    expect(mockLogInstance.warn).toHaveBeenCalledWith(
      "Trending cache write failed",
      expect.any(Object),
    );
  });
});
