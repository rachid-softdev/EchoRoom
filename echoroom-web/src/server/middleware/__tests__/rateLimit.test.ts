import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// checkRateLimit tests
// ---------------------------------------------------------------------------
// Uses Redis sorted sets for sliding window rate limiting.
// Falls back silently when Redis is unavailable.
//
// IMPORTANT: vi.mock is hoisted above all imports. Use vi.hoisted() for vars.

const { mockZcount, mockZadd, mockExpire, redisAvailable } = vi.hoisted(() => {
  const state = { value: true };
  return {
    mockZcount: vi.fn(),
    mockZadd: vi.fn(),
    mockExpire: vi.fn(),
    redisAvailable: state,
  };
});

vi.mock("@/lib/redis", () => ({
  get redis() {
    if (!redisAvailable.value) return null;
    return {
      zcount: mockZcount,
      zadd: mockZadd,
      expire: mockExpire,
    };
  },
}));

// Mock logger to capture warning about Redis fallback
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should allow request when under the limit", async () => {
    mockZcount.mockResolvedValue(5); // 5 requests in window
    mockZadd.mockResolvedValue(1);
    mockExpire.mockResolvedValue(1);

    const { checkRateLimit } = await import("../rateLimit");

    await expect(
      checkRateLimit({ identifier: "user-1", limit: 10, window: 60 }),
    ).resolves.toBeUndefined();

    expect(mockZcount).toHaveBeenCalled();
    expect(mockZadd).toHaveBeenCalled();
    expect(mockExpire).toHaveBeenCalled();
  });

  it("should throw TOO_MANY_REQUESTS when at the limit", async () => {
    mockZcount.mockResolvedValue(10); // Already at limit

    const { checkRateLimit } = await import("../rateLimit");

    await expect(
      checkRateLimit({ identifier: "user-1", limit: 10, window: 60 }),
    ).rejects.toThrow("Trop de requêtes");

    expect(mockZadd).not.toHaveBeenCalled();
    expect(mockExpire).not.toHaveBeenCalled();
  });

  it("should throw TOO_MANY_REQUESTS when over the limit", async () => {
    mockZcount.mockResolvedValue(15); // Over limit

    const { checkRateLimit } = await import("../rateLimit");

    await expect(
      checkRateLimit({ identifier: "user-1", limit: 10, window: 60 }),
    ).rejects.toThrow("Trop de requêtes");
  });

  it("should use correct Redis key format", async () => {
    mockZcount.mockResolvedValue(0);
    mockZadd.mockResolvedValue(1);
    mockExpire.mockResolvedValue(1);

    const { checkRateLimit } = await import("../rateLimit");

    await checkRateLimit({ identifier: "api:user-1", limit: 5, window: 30 });

    expect(mockZcount).toHaveBeenCalledWith(
      "ratelimit:api:user-1",
      expect.any(Number),
      expect.any(Number),
    );
    expect(mockExpire).toHaveBeenCalledWith("ratelimit:api:user-1", 30);
  });

  it("should use unique member names to prevent deduplication", async () => {
    mockZcount.mockResolvedValue(0);
    mockZadd.mockResolvedValue(1);
    mockExpire.mockResolvedValue(1);

    const { checkRateLimit } = await import("../rateLimit");

    await checkRateLimit({ identifier: "user-1", limit: 10, window: 60 });

    expect(mockZadd).toHaveBeenCalledTimes(1);
    const zaddArg = mockZadd.mock.calls[0]!;
    expect(zaddArg[0]!).toBe("ratelimit:user-1");
    expect(zaddArg[1]!).toHaveProperty("score");
    expect(zaddArg[1]!).toHaveProperty("member");
    // Member should contain the identifier and a timestamp
    expect(zaddArg[1]!.member).toContain("user-1:");
  });

  it("should handle very low limits (limit = 1)", async () => {
    mockZcount.mockResolvedValue(0);
    mockZadd.mockResolvedValue(1);
    mockExpire.mockResolvedValue(1);

    const { checkRateLimit } = await import("../rateLimit");

    // First request passes
    await expect(
      checkRateLimit({ identifier: "user-1", limit: 1, window: 60 }),
    ).resolves.toBeUndefined();

    // Second request hits limit
    mockZcount.mockResolvedValue(1);
    await expect(
      checkRateLimit({ identifier: "user-1", limit: 1, window: 60 }),
    ).rejects.toThrow("Trop de requêtes");
  });
});

describe("checkRateLimit — Redis unavailable / failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the module-level redisUnavailableLogged flag
    vi.resetModules();
  });

  afterEach(() => {
    // Restore Redis availability for other tests
    redisAvailable.value = true;
  });

  it("should fallback to in-memory store when redis is null", async () => {
    redisAvailable.value = false;

    const { checkRateLimit } = await import("../rateLimit");

    // Should not throw when using in-memory fallback
    await expect(
      checkRateLimit({ identifier: "fallback-user", limit: 10, window: 60 }),
    ).resolves.toBeUndefined();
  });

  it("should allow requests within the in-memory limit when redis is null", async () => {
    redisAvailable.value = false;

    const { checkRateLimit } = await import("../rateLimit");

    // First request passes
    await expect(
      checkRateLimit({ identifier: "mem-user", limit: 3, window: 60 }),
    ).resolves.toBeUndefined();

    // Second passes
    await expect(
      checkRateLimit({ identifier: "mem-user", limit: 3, window: 60 }),
    ).resolves.toBeUndefined();

    // Third passes
    await expect(
      checkRateLimit({ identifier: "mem-user", limit: 3, window: 60 }),
    ).resolves.toBeUndefined();

    // Fourth hits limit
    await expect(
      checkRateLimit({ identifier: "mem-user", limit: 3, window: 60 }),
    ).rejects.toThrow("Trop de requêtes");
  });

  it("should fallback to in-memory store when Redis zcount throws", async () => {
    mockZcount.mockRejectedValue(new Error("Redis connection refused"));

    const { checkRateLimit } = await import("../rateLimit");

    // Should fallback to in-memory, not throw
    await expect(
      checkRateLimit({ identifier: "recover-user", limit: 10, window: 60 }),
    ).resolves.toBeUndefined();
  });

  it("should fallback to in-memory store when Redis zadd throws", async () => {
    mockZcount.mockResolvedValue(0);
    mockZadd.mockRejectedValue(new Error("Redis write failure"));

    const { checkRateLimit } = await import("../rateLimit");

    await expect(
      checkRateLimit({ identifier: "zadd-fail", limit: 10, window: 60 }),
    ).resolves.toBeUndefined();
  });

  it("should re-throw TRPCError directly (not fallback for rate limit hits)", async () => {
    mockZcount.mockResolvedValue(10); // Already at limit

    const { checkRateLimit } = await import("../rateLimit");

    // TRPCError from zcount should be re-thrown, NOT fallback to in-memory
    await expect(
      checkRateLimit({ identifier: "strict-user", limit: 10, window: 60 }),
    ).rejects.toThrow("Trop de requêtes");
  });
});

describe("checkRateLimit — sliding window", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should allow request just after window reset (old entries expired)", async () => {
    // Simulate: first request at t=0, then at t=61 (window=60), zcount no longer counts old request
    mockZcount.mockResolvedValueOnce(0); // First call: 0 requests
    mockZadd.mockResolvedValueOnce(1);
    mockExpire.mockResolvedValueOnce(1);
    // Second call: window has slid, old entry has fallen out
    mockZcount.mockResolvedValueOnce(0);
    mockZadd.mockResolvedValueOnce(1);
    mockExpire.mockResolvedValueOnce(1);

    const { checkRateLimit } = await import("../rateLimit");

    // First request at t=0
    await expect(
      checkRateLimit({ identifier: "window-slide", limit: 1, window: 60 }),
    ).resolves.toBeUndefined();

    // Second request as if t=61 — old entry should have fallen out of the window
    await expect(
      checkRateLimit({ identifier: "window-slide", limit: 1, window: 60 }),
    ).resolves.toBeUndefined();
  });

  it("should block request when still within the same window", async () => {
    mockZcount.mockResolvedValueOnce(0); // First: 0
    mockZadd.mockResolvedValueOnce(1);
    mockExpire.mockResolvedValueOnce(1);
    mockZcount.mockResolvedValueOnce(1); // Second: 1 (at limit of 1)

    const { checkRateLimit } = await import("../rateLimit");

    await expect(
      checkRateLimit({ identifier: "block-window", limit: 1, window: 60 }),
    ).resolves.toBeUndefined();

    await expect(
      checkRateLimit({ identifier: "block-window", limit: 1, window: 60 }),
    ).rejects.toThrow("Trop de requêtes");
  });
});

describe("checkRateLimit — concurrent requests (race condition)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should allow at most 'limit' requests when fired concurrently (with Redis mock)", async () => {
    // Simulate a race condition: zcount is called before zadd records the new entry.
    // We use a counter-based mock where zcount returns values 0..limit-1 for the first
    // 'limit' calls, then 'limit' for subsequent calls (simulating that the first
    // 'limit' requests haven't been recorded yet).
    let callIdx = 0;
    mockZcount.mockImplementation(async () => {
      callIdx++;
      if (callIdx <= 5) return callIdx - 1; // 0, 1, 2, 3, 4 → all below limit 5
      return 5; // At or above limit
    });
    mockZadd.mockResolvedValue(1);
    mockExpire.mockResolvedValue(1);

    const { checkRateLimit } = await import("../rateLimit");

    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        checkRateLimit({ identifier: "race-user", limit: 5, window: 60 })
          .then(() => "ok" as const)
          .catch(() => "limited" as const),
      ),
    );

    const ok = results.filter((r) => r === "ok").length;
    const limited = results.filter((r) => r === "limited").length;

    expect(ok).toBe(5);
    expect(limited).toBe(15);
  });
});
