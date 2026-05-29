import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// withIPRateLimit tests
// ---------------------------------------------------------------------------
// tRPC middleware that rate-limits by IP address using Redis sorted sets.
// Falls back when Redis is unavailable.

const { mockZcount, mockZadd, mockExpire } = vi.hoisted(() => ({
  mockZcount: vi.fn(),
  mockZadd: vi.fn(),
  mockExpire: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    zcount: mockZcount,
    zadd: mockZadd,
    expire: mockExpire,
  },
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
