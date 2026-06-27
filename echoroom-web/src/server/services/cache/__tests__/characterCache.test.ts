import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Character Cache Tests
// ---------------------------------------------------------------------------
// Tests for characterCache.ts:
//   - Graceful degradation when redis is null
//   - getCachedCharacters calls redis.get with correct key (version + category)
//   - setCachedCharacters calls redis.set with correct key and TTL
//   - invalidateCharacterCache increments version and sets expiry
//   - getCacheVersion returns 0 when redis is null

const mockLogInstance = {
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => mockLogInstance),
}));

const mockRedisInstance = {
  get: vi.fn(),
  set: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
};

vi.mock("@/lib/redis", () => ({
  redis: mockRedisInstance,
}));

describe("characterCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // getCachedCharacters
  // -----------------------------------------------------------------------

  describe("getCachedCharacters", () => {
    it("should return null when getCacheVersion returns undefined (graceful degradation)", async () => {
      // Version resolves to 0 when redis returns undefined
      mockRedisInstance.get.mockResolvedValue(undefined);

      const { getCachedCharacters } = await import("../characterCache");
      const result = await getCachedCharacters({ category: "romantic" });
      expect(result).toBeNull();
    });

    it("should call redis.get with correct key including version and category", async () => {
      mockRedisInstance.get
        .mockResolvedValueOnce(3) // getCacheVersion returns 3
        .mockResolvedValueOnce({ id: "char-1", name: "Alice" }); // cached data

      const { getCachedCharacters } = await import("../characterCache");

      const result = await getCachedCharacters({ category: "romantic" });

      expect(result).toEqual({ id: "char-1", name: "Alice" });
      expect(mockRedisInstance.get).toHaveBeenCalledTimes(2);
      // First call: version key
      expect(mockRedisInstance.get).toHaveBeenNthCalledWith(1, "cache:characters:version");
      // Second call: cache key with version and category
      expect(mockRedisInstance.get).toHaveBeenNthCalledWith(2, "cache:characters:v3:romantic");
    });

    it("should use 'all' category when no category is provided", async () => {
      mockRedisInstance.get.mockResolvedValueOnce(5).mockResolvedValueOnce({ items: [] });

      const { getCachedCharacters } = await import("../characterCache");

      await getCachedCharacters();

      expect(mockRedisInstance.get).toHaveBeenNthCalledWith(2, "cache:characters:v5:all");
    });

    it("should return null when cached data is null (cache miss)", async () => {
      mockRedisInstance.get.mockResolvedValueOnce(1).mockResolvedValueOnce(null);

      const { getCachedCharacters } = await import("../characterCache");

      const result = await getCachedCharacters({ category: "horror" });
      expect(result).toBeNull();
    });

    it("should return null when getCacheVersion returns 0", async () => {
      mockRedisInstance.get
        .mockResolvedValueOnce(undefined) // version resolves to 0 via ?? 0
        .mockResolvedValueOnce(null);

      const { getCachedCharacters } = await import("../characterCache");

      const result = await getCachedCharacters({ category: "weird" });
      // version is 0, key is "cache:characters:v0:weird"
      expect(mockRedisInstance.get).toHaveBeenNthCalledWith(2, "cache:characters:v0:weird");
      expect(result).toBeNull();
    });

    it("should return null on redis error and log warning", async () => {
      mockRedisInstance.get.mockRejectedValue(new Error("Redis connection failed"));

      const { getCachedCharacters } = await import("../characterCache");

      const result = await getCachedCharacters({ category: "romantic" });
      expect(result).toBeNull();

      expect(mockLogInstance.warn).toHaveBeenCalledWith(
        "Character cache read failed",
        expect.any(Object),
      );
    });
  });

  // -----------------------------------------------------------------------
  // setCachedCharacters
  // -----------------------------------------------------------------------

  describe("setCachedCharacters", () => {
    it("should call redis.set with correct key, JSON data, and TTL 60s", async () => {
      mockRedisInstance.get.mockResolvedValue(2); // version
      mockRedisInstance.set.mockResolvedValue("OK");

      const { setCachedCharacters } = await import("../characterCache");

      const data = { id: "char-1", name: "Alice" };
      await setCachedCharacters(data, { category: "romantic" });

      expect(mockRedisInstance.get).toHaveBeenCalledWith("cache:characters:version");
      expect(mockRedisInstance.set).toHaveBeenCalledWith(
        "cache:characters:v2:romantic",
        JSON.stringify(data),
        { ex: 60 },
      );
    });

    it("should use 'all' category when params are empty", async () => {
      mockRedisInstance.get.mockResolvedValue(1);
      mockRedisInstance.set.mockResolvedValue("OK");

      const { setCachedCharacters } = await import("../characterCache");

      await setCachedCharacters({ x: 1 });

      expect(mockRedisInstance.set).toHaveBeenCalledWith(
        "cache:characters:v1:all",
        expect.any(String),
        { ex: 60 },
      );
    });

    it("should handle redis error gracefully and log warning", async () => {
      mockRedisInstance.get.mockResolvedValue(1);
      mockRedisInstance.set.mockRejectedValue(new Error("Write failed"));

      const { setCachedCharacters } = await import("../characterCache");

      await expect(setCachedCharacters({ x: 1 })).resolves.toBeUndefined();

      expect(mockLogInstance.warn).toHaveBeenCalledWith(
        "Character cache write failed",
        expect.any(Object),
      );
    });

    it("should not throw when getCacheVersion returns undefined (data still stored)", async () => {
      // Version returns undefined so key uses v0
      mockRedisInstance.get.mockResolvedValue(undefined);
      mockRedisInstance.set.mockResolvedValue("OK");

      const { setCachedCharacters } = await import("../characterCache");

      await expect(setCachedCharacters({ x: 1 })).resolves.toBeUndefined();

      expect(mockRedisInstance.set).toHaveBeenCalledWith(
        "cache:characters:v0:all",
        expect.any(String),
        { ex: 60 },
      );
    });
  });

  // -----------------------------------------------------------------------
  // invalidateCharacterCache
  // -----------------------------------------------------------------------

  describe("invalidateCharacterCache", () => {
    it("should increment version key and set expiry", async () => {
      mockRedisInstance.incr.mockResolvedValue(6);
      mockRedisInstance.expire.mockResolvedValue(1);

      const { invalidateCharacterCache } = await import("../characterCache");

      await invalidateCharacterCache();

      expect(mockRedisInstance.incr).toHaveBeenCalledWith("cache:characters:version");
      expect(mockRedisInstance.expire).toHaveBeenCalledWith("cache:characters:version", 3600);
    });

    it("should handle redis error gracefully and log warning", async () => {
      mockRedisInstance.incr.mockRejectedValue(new Error("Incr failed"));

      const { invalidateCharacterCache } = await import("../characterCache");

      await expect(invalidateCharacterCache()).resolves.toBeUndefined();

      expect(mockLogInstance.warn).toHaveBeenCalledWith(
        "Character cache invalidation failed",
        expect.any(Object),
      );
    });

    it("should handle undefined version gracefully (still increments)", async () => {
      mockRedisInstance.incr.mockResolvedValue(undefined as any);
      mockRedisInstance.expire.mockResolvedValue(1);

      const { invalidateCharacterCache } = await import("../characterCache");

      await expect(invalidateCharacterCache()).resolves.toBeUndefined();

      expect(mockRedisInstance.incr).toHaveBeenCalledWith("cache:characters:version");
      expect(mockRedisInstance.expire).toHaveBeenCalledWith("cache:characters:version", 3600);
    });
  });
});
