import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// withIPRateLimit tests
// ---------------------------------------------------------------------------
// tRPC middleware that rate-limits by IP address using Redis sorted sets.
// Falls back when Redis is unavailable.

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

// Mock logger to capture fallback warnings
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock the trpc middleware factory
// The middleware function is mocked to return a callable wrapper
// that matches tRPC's MiddlewareBuilder interface
type MiddlewareFn = (opts: { ctx: unknown; next: unknown; path: string }) => Promise<unknown>;
vi.mock("@/server/trpc", () => ({
  middleware: vi.fn((fn: MiddlewareFn): MiddlewareFn => fn),
}));

function createMockCtx(headers: Record<string, string | null>) {
  return {
    headers: {
      get: (name: string) => headers[name] ?? null,
    },
  };
}

function createMockNext() {
  return vi.fn().mockResolvedValue({ ok: true });
}

describe("withIPRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should allow request when under the limit", async () => {
    mockZcount.mockResolvedValue(3);
    mockZadd.mockResolvedValue(1);
    mockExpire.mockResolvedValue(1);

    const { withIPRateLimit } = await import("../ipRateLimit");

    const middleware = withIPRateLimit({ limit: 10, window: 60 });
    const ctx = createMockCtx({
      "x-forwarded-for": "192.168.1.1",
    });
    const next = createMockNext();

    // @ts-expect-error — mocked middleware is callable at runtime
    const result = await middleware({ ctx, next, path: "user.getProfile" });

    expect(result).toEqual({ ok: true });
    expect(next).toHaveBeenCalled();

    expect(mockZcount).toHaveBeenCalledWith(
      "iplimit:user.getProfile:192.168.1.1",
      expect.any(Number),
      expect.any(Number),
    );
    expect(mockZadd).toHaveBeenCalled();
    expect(mockExpire).toHaveBeenCalledWith("iplimit:user.getProfile:192.168.1.1", 60);
  });

  it("should use x-real-ip when x-forwarded-for is not available", async () => {
    mockZcount.mockResolvedValue(0);
    mockZadd.mockResolvedValue(1);
    mockExpire.mockResolvedValue(1);

    const { withIPRateLimit } = await import("../ipRateLimit");

    const middleware = withIPRateLimit({ limit: 10, window: 60 });
    const ctx = createMockCtx({
      "x-real-ip": "10.0.0.1",
    });
    const next = createMockNext();

    // @ts-expect-error — mocked middleware is callable at runtime
    await middleware({ ctx, next, path: "call.start" });

    expect(mockZcount).toHaveBeenCalledWith(
      "iplimit:call.start:10.0.0.1",
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("should fall back to 'unknown' when no IP headers are present", async () => {
    mockZcount.mockResolvedValue(0);
    mockZadd.mockResolvedValue(1);
    mockExpire.mockResolvedValue(1);

    const { withIPRateLimit } = await import("../ipRateLimit");

    const middleware = withIPRateLimit({ limit: 10, window: 60 });
    const ctx = createMockCtx({});
    const next = createMockNext();

    // @ts-expect-error — mocked middleware is callable at runtime
    await middleware({ ctx, next, path: "test" });

    expect(mockZcount).toHaveBeenCalledWith(
      "iplimit:test:unknown",
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("should use the first IP from x-forwarded-for list", async () => {
    mockZcount.mockResolvedValue(0);
    mockZadd.mockResolvedValue(1);
    mockExpire.mockResolvedValue(1);

    const { withIPRateLimit } = await import("../ipRateLimit");

    const middleware = withIPRateLimit({ limit: 10, window: 60 });
    const ctx = createMockCtx({
      "x-forwarded-for": "203.0.113.1, 198.51.100.2, 192.0.2.3",
    });
    const next = createMockNext();

    // @ts-expect-error — mocked middleware is callable at runtime
    await middleware({ ctx, next, path: "test" });

    expect(mockZcount).toHaveBeenCalledWith(
      "iplimit:test:203.0.113.1",
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("should throw TOO_MANY_REQUESTS when at the limit", async () => {
    mockZcount.mockResolvedValue(10);

    const { withIPRateLimit } = await import("../ipRateLimit");

    const middleware = withIPRateLimit({ limit: 10, window: 60 });
    const ctx = createMockCtx({
      "x-forwarded-for": "192.168.1.1",
    });
    const next = createMockNext();

    await expect(
      // @ts-expect-error — mocked middleware is callable at runtime
      middleware({ ctx, next, path: "test" }),
    ).rejects.toThrow("Trop de requêtes");

    expect(next).not.toHaveBeenCalled();
  });

  it("should throw TOO_MANY_REQUESTS when over the limit", async () => {
    mockZcount.mockResolvedValue(20);

    const { withIPRateLimit } = await import("../ipRateLimit");

    const middleware = withIPRateLimit({ limit: 10, window: 60 });
    const ctx = createMockCtx({
      "x-forwarded-for": "192.168.1.1",
    });
    const next = createMockNext();

    await expect(
      // @ts-expect-error — mocked middleware is callable at runtime
      middleware({ ctx, next, path: "test" }),
    ).rejects.toThrow("Trop de requêtes");
  });

  it("should handle IPv6 addresses", async () => {
    mockZcount.mockResolvedValue(0);
    mockZadd.mockResolvedValue(1);
    mockExpire.mockResolvedValue(1);

    const { withIPRateLimit } = await import("../ipRateLimit");

    const middleware = withIPRateLimit({ limit: 10, window: 60 });
    const ctx = createMockCtx({
      "x-forwarded-for": "2001:db8::1",
    });
    const next = createMockNext();

    // @ts-expect-error — mocked middleware is callable at runtime
    await middleware({ ctx, next, path: "test" });

    expect(mockZcount).toHaveBeenCalledWith(
      "iplimit:test:2001:db8::1",
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("should set expiry on the correct key", async () => {
    mockZcount.mockResolvedValue(0);
    mockZadd.mockResolvedValue(1);
    mockExpire.mockResolvedValue(1);

    const { withIPRateLimit } = await import("../ipRateLimit");

    const middleware = withIPRateLimit({ limit: 5, window: 120 });
    const ctx = createMockCtx({
      "x-forwarded-for": "10.0.0.1",
    });
    const next = createMockNext();

    // @ts-expect-error — mocked middleware is callable at runtime
    await middleware({ ctx, next, path: "test" });
    expect(mockExpire).toHaveBeenCalledWith("iplimit:test:10.0.0.1", 120);
  });
});

describe("withIPRateLimit — Redis failure fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    redisAvailable.value = true;
  });

  it("should fallback to in-memory rate limiting when Redis is null", async () => {
    redisAvailable.value = false;

    const { withIPRateLimit } = await import("../ipRateLimit");

    const middleware = withIPRateLimit({ limit: 5, window: 60 });
    const ctx = createMockCtx({
      "x-forwarded-for": "192.168.1.100",
    });
    const next = createMockNext();

    // Should not throw when Redis is null (in-memory fallback)
    // @ts-expect-error — mocked middleware is callable at runtime
    await expect(middleware({ ctx, next, path: "fallback.test" })).resolves.toEqual({ ok: true });

    expect(next).toHaveBeenCalled();
  });

  it("should enforce in-memory rate limits when Redis is null", async () => {
    redisAvailable.value = false;

    const { withIPRateLimit } = await import("../ipRateLimit");

    const middleware = withIPRateLimit({ limit: 2, window: 60 });
    const ctx = createMockCtx({
      "x-forwarded-for": "10.0.0.55",
    });
    const next1 = createMockNext();
    const next2 = createMockNext();
    const next3 = createMockNext();

    // @ts-expect-error — mocked middleware is callable at runtime
    await expect(middleware({ ctx, next: next1, path: "memlimit" })).resolves.toEqual({ ok: true });
    expect(next1).toHaveBeenCalled();

    // @ts-expect-error — mocked middleware is callable at runtime
    await expect(middleware({ ctx, next: next2, path: "memlimit" })).resolves.toEqual({ ok: true });
    expect(next2).toHaveBeenCalled();

    // @ts-expect-error — mocked middleware is callable at runtime
    await expect(middleware({ ctx, next: next3, path: "memlimit" })).rejects.toThrow(
      "Trop de requêtes",
    );
    expect(next3).not.toHaveBeenCalled();
  });
});

describe("withIPRateLimit — IP spoofing protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should apply rate limit to private IP from x-forwarded-for (127.0.0.1)", async () => {
    // Even private/localhost IPs should be rate limited
    mockZcount.mockResolvedValue(0);
    mockZadd.mockResolvedValue(1);
    mockExpire.mockResolvedValue(1);

    const { withIPRateLimit } = await import("../ipRateLimit");

    const middleware = withIPRateLimit({ limit: 10, window: 60 });
    const ctx = createMockCtx({
      "x-forwarded-for": "127.0.0.1",
    });
    const next = createMockNext();

    // @ts-expect-error — mocked middleware is callable at runtime
    await middleware({ ctx, next, path: "test" });

    expect(mockZcount).toHaveBeenCalledWith(
      "iplimit:test:127.0.0.1",
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("should apply rate limit to loopback IPv6 (::1)", async () => {
    mockZcount.mockResolvedValue(0);
    mockZadd.mockResolvedValue(1);
    mockExpire.mockResolvedValue(1);

    const { withIPRateLimit } = await import("../ipRateLimit");

    const middleware = withIPRateLimit({ limit: 10, window: 60 });
    const ctx = createMockCtx({
      "x-forwarded-for": "::1",
    });
    const next = createMockNext();

    // @ts-expect-error — mocked middleware is callable at runtime
    await middleware({ ctx, next, path: "test" });

    expect(mockZcount).toHaveBeenCalledWith(
      "iplimit:test:::1",
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("should apply rate limit to spoofed x-forwarded-for with private range", async () => {
    // x-forwarded-for can be spoofed by clients; the rate limit should apply
    // to the spoofed IP (no bypass via private IPs)
    mockZcount.mockResolvedValue(0);
    mockZadd.mockResolvedValue(1);
    mockExpire.mockResolvedValue(1);

    const { withIPRateLimit } = await import("../ipRateLimit");

    const middleware = withIPRateLimit({ limit: 10, window: 60 });
    const ctx = createMockCtx({
      "x-forwarded-for": "10.0.0.1", // Private IP range
    });
    const next = createMockNext();

    // @ts-expect-error — mocked middleware is callable at runtime
    await middleware({ ctx, next, path: "test" });

    expect(mockZcount).toHaveBeenCalledWith(
      "iplimit:test:10.0.0.1",
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("should rate limit by exact spoofed IP even if it matches internal network", async () => {
    mockZcount.mockResolvedValueOnce(9); // near limit
    mockZadd.mockResolvedValueOnce(1);
    mockExpire.mockResolvedValueOnce(1);
    mockZcount.mockResolvedValueOnce(10); // at limit → block

    const { withIPRateLimit } = await import("../ipRateLimit");

    const middleware = withIPRateLimit({ limit: 10, window: 60 });
    const ctx = createMockCtx({
      "x-forwarded-for": "192.168.1.99",
    });

    // First request passes (9 < 10)
    // @ts-expect-error — mocked middleware is callable at runtime
    await expect(middleware({ ctx, next: createMockNext(), path: "spoof" })).resolves.toEqual({
      ok: true,
    });

    // Second request hits limit (10 >= 10)
    // @ts-expect-error — mocked middleware is callable at runtime
    await expect(middleware({ ctx, next: createMockNext(), path: "spoof" })).rejects.toThrow(
      "Trop de requêtes",
    );
  });
});
