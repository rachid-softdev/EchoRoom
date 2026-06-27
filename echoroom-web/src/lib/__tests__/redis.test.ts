import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Redis URL validation tests
// ---------------------------------------------------------------------------
// Tests that redis.ts handles malformed REDIS_URL and missing REDIS_URL
// gracefully without crashing at module import time.
//
// The redis.ts module:
//   1. Checks if env.REDIS_URL is set
//   2. Tries to parse it with new URL()
//   3. If parsing fails, throws an error caught by the outer try/catch
//   4. Falls back gracefully with redis = null

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe("Redis URL validation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("should not crash when REDIS_URL is a valid URL", async () => {
    vi.doMock("@/lib/env", () => ({
      env: {
        REDIS_URL: "https://valid-redis-url.example.com:6379",
      },
    }));

    // Should not throw
    const mod = await import("../redis");
    expect(mod.redis).not.toBeNull();
  });

  it("should not crash when REDIS_URL is a fully valid Upstash URL", async () => {
    vi.doMock("@/lib/env", () => ({
      env: {
        REDIS_URL: "https://us1-actual-redis.upstash.io:6379",
      },
    }));

    const mod = await import("../redis");
    expect(mod.redis).not.toBeNull();
  });

  it("should not crash when REDIS_URL is missing (undefined)", async () => {
    vi.doMock("@/lib/env", () => ({
      env: {
        REDIS_URL: undefined,
      },
    }));

    // Should not throw — redis should be null
    const mod = await import("../redis");
    expect(mod.redis).toBeNull();
  });

  it("should not crash when REDIS_URL is an empty string", async () => {
    vi.doMock("@/lib/env", () => ({
      env: {
        REDIS_URL: "",
      },
    }));

    // Empty string is falsy, so redis should be null
    const mod = await import("../redis");
    expect(mod.redis).toBeNull();
  });

  it("should not crash when REDIS_URL is malformed (not a valid URL)", async () => {
    vi.doMock("@/lib/env", () => ({
      env: {
        REDIS_URL: "not-a-valid-url",
      },
    }));

    // Should not crash — the inner try/catch catches the URL parse error,
    // the outer try/catch catches the thrown error, and redis stays null
    const mod = await import("../redis");
    expect(mod.redis).toBeNull();
  });

  it("should not crash when REDIS_URL uses https:// protocol with credentials", async () => {
    vi.doMock("@/lib/env", () => ({
      env: {
        REDIS_URL: "https://:password@host.com:6379",
      },
    }));

    // Upstash Redis uses HTTPS REST API, not redis:// protocol
    const mod = await import("../redis");
    expect(mod.redis).not.toBeNull();
  });

  it("should not crash when REDIS_URL has special characters that need encoding", async () => {
    vi.doMock("@/lib/env", () => ({
      env: {
        REDIS_URL: "https://user:pass-with-special-chars@host.com:6379",
      },
    }));

    const mod = await import("../redis");
    expect(mod.redis).not.toBeNull();
  });

  it("should not crash when REDIS_URL is a malformed URL with spaces", async () => {
    vi.doMock("@/lib/env", () => ({
      env: {
        REDIS_URL: "https://host with spaces.com:6379",
      },
    }));

    // URLs with spaces should fail new URL() parsing → caught by inner try/catch
    const mod = await import("../redis");
    expect(mod.redis).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Redis constructor tests — token extraction and constructor calls
// ---------------------------------------------------------------------------
describe("Redis constructor — token and URL handling", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("should call Redis constructor with URL and token", async () => {
    // Mock Redis class to intercept constructor calls
    const mockRedisInstance = {};
    const RedisMock = vi.fn(() => mockRedisInstance);

    vi.doMock("@/lib/env", () => ({
      env: {
        REDIS_URL: "https://us1-valid.upstash.io:6379",
        REDIS_TOKEN: "my-secret-token",
      },
    }));

    vi.doMock("@upstash/redis", () => ({
      Redis: RedisMock,
    }));

    const mod = await import("../redis");

    expect(mod.redis).toBe(mockRedisInstance);
    expect(RedisMock).toHaveBeenCalledWith({
      url: "https://us1-valid.upstash.io:6379",
      token: "my-secret-token",
    });
  });

  it("should extract token from URL password when REDIS_TOKEN is absent", async () => {
    const mockRedisInstance = {};
    const RedisMock = vi.fn(() => mockRedisInstance);

    vi.doMock("@/lib/env", () => ({
      env: {
        REDIS_URL: "https://:url-password-token@host.com:6379",
        // REDIS_TOKEN is NOT set
      },
    }));

    vi.doMock("@upstash/redis", () => ({
      Redis: RedisMock,
    }));

    await import("../redis");

    expect(RedisMock).toHaveBeenCalledWith({
      url: "https://:url-password-token@host.com:6379",
      token: "url-password-token",
    });
  });

  it("should use REDIS_TOKEN over URL password when both are present", async () => {
    const mockRedisInstance = {};
    const RedisMock = vi.fn(() => mockRedisInstance);

    vi.doMock("@/lib/env", () => ({
      env: {
        REDIS_URL: "https://:url-password@host.com:6379",
        REDIS_TOKEN: "explicit-token",
      },
    }));

    vi.doMock("@upstash/redis", () => ({
      Redis: RedisMock,
    }));

    await import("../redis");

    expect(RedisMock).toHaveBeenCalledWith({
      url: "https://:url-password@host.com:6379",
      token: "explicit-token",
    });
  });

  it("should set redis export to null when Redis constructor throws", async () => {
    vi.doMock("@/lib/env", () => ({
      env: {
        REDIS_URL: "https://localhost:6379",
      },
    }));

    // Mock Redis constructor to throw
    vi.doMock("@upstash/redis", () => ({
      Redis: vi.fn(() => {
        throw new Error("Redis init failed");
      }),
    }));

    const mod = await import("../redis");

    // Should not crash — outer try/catch catches and redis stays null
    expect(mod.redis).toBeNull();
  });

  it("should pass undefined token when URL has no password and no REDIS_TOKEN", async () => {
    const mockRedisInstance = {};
    const RedisMock = vi.fn(() => mockRedisInstance);

    vi.doMock("@/lib/env", () => ({
      env: {
        REDIS_URL: "https://host-without-password.com:6379",
        // REDIS_TOKEN is not set, URL has no password
      },
    }));

    vi.doMock("@upstash/redis", () => ({
      Redis: RedisMock,
    }));

    await import("../redis");

    // url.password for "https://host-without-password.com:6379" is ""
    // env.REDIS_TOKEN is undefined
    // So token should be: undefined ?? ("" || undefined) = undefined
    expect(RedisMock).toHaveBeenCalledWith({
      url: "https://host-without-password.com:6379",
      token: undefined,
    });
  });
});
