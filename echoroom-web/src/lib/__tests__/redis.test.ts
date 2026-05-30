import { describe, it, expect, vi, beforeEach } from "vitest";

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
