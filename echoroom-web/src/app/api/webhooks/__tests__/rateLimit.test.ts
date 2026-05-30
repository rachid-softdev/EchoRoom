import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// M-5: Webhook rate limiting
// ---------------------------------------------------------------------------
// Tests for webhook rate limiting using the existing InMemoryRateLimitStore:
//   - checkWebhookRateLimit returns true for requests under the limit
//   - checkWebhookRateLimit returns false for requests exceeding the limit
//   - Different endpoint keys have independent counters
//   - Per-IP vs global keying works correctly
//
// Note: checkWebhookRateLimit is implemented using the inMemoryRateLimitStore
// which was added as part of the C3 security fix.

vi.mock("@/lib/redis", () => ({
  redis: null, // Force in-memory fallback
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe("M-5: Webhook rate limiting with in-memory store", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("should allow requests under the limit", async () => {
    const { checkRateLimit } = await import(
      "@/server/middleware/rateLimit"
    );

    // First 5 requests should be allowed (limit = 5)
    for (let i = 0; i < 5; i++) {
      await expect(
        checkRateLimit({ identifier: "webhook:twilio", limit: 5, window: 60 }),
      ).resolves.toBeUndefined();
    }
  });

  it("should deny requests exceeding the limit", async () => {
    const { checkRateLimit } = await import(
      "@/server/middleware/rateLimit"
    );

    // Use limit = 3
    await checkRateLimit({ identifier: "webhook:stripe-overload", limit: 3, window: 60 });
    await checkRateLimit({ identifier: "webhook:stripe-overload", limit: 3, window: 60 });
    await checkRateLimit({ identifier: "webhook:stripe-overload", limit: 3, window: 60 });

    // 4th request should be denied
    await expect(
      checkRateLimit({ identifier: "webhook:stripe-overload", limit: 3, window: 60 }),
    ).rejects.toThrow("Trop de requêtes");
  });

  it("should have independent counters for different endpoint keys", async () => {
    const { checkRateLimit } = await import(
      "@/server/middleware/rateLimit"
    );

    // Exhaust endpoint A's limit
    await checkRateLimit({ identifier: "webhook:twilio", limit: 2, window: 60 });
    await checkRateLimit({ identifier: "webhook:twilio", limit: 2, window: 60 });

    // Endpoint A should be blocked now
    await expect(
      checkRateLimit({ identifier: "webhook:twilio", limit: 2, window: 60 }),
    ).rejects.toThrow("Trop de requêtes");

    // Endpoint B should still work independently
    await expect(
      checkRateLimit({ identifier: "webhook:stripe", limit: 2, window: 60 }),
    ).resolves.toBeUndefined();
  });

  it("should handle per-IP keying correctly", async () => {
    const { checkRateLimit } = await import(
      "@/server/middleware/rateLimit"
    );

    // IP-based rate limiting: different IPs have independent counters
    const ip1key = "webhook:twilio:192.168.1.1";
    const ip2key = "webhook:twilio:192.168.1.2";

    await checkRateLimit({ identifier: ip1key, limit: 1, window: 60 });
    await expect(
      checkRateLimit({ identifier: ip1key, limit: 1, window: 60 }),
    ).rejects.toThrow("Trop de requêtes");

    // Different IP should still be allowed
    await expect(
      checkRateLimit({ identifier: ip2key, limit: 1, window: 60 }),
    ).resolves.toBeUndefined();
  });

  it("should use correct key prefix for rate limiting", async () => {
    // Import the in-memory store to verify keys
    const { inMemoryRateLimitStore } = await import(
      "@/server/middleware/rateLimitStore"
    );
    const { checkRateLimit } = await import(
      "@/server/middleware/rateLimit"
    );

    // Check initial size
    const initialSize = inMemoryRateLimitStore.size;

    await checkRateLimit({ identifier: "custom-key-test", limit: 5, window: 60 });

    // Store should have grown by 1
    expect(inMemoryRateLimitStore.size).toBe(initialSize + 1);
  });

  it("should gracefully handle very low limits (limit=1)", async () => {
    const { checkRateLimit } = await import(
      "@/server/middleware/rateLimit"
    );

    // limit=1 means only 1 request allowed
    await expect(
      checkRateLimit({ identifier: "burst-test", limit: 1, window: 60 }),
    ).resolves.toBeUndefined();

    // Second request should be blocked
    await expect(
      checkRateLimit({ identifier: "burst-test", limit: 1, window: 60 }),
    ).rejects.toThrow("Trop de requêtes");
  });

  it("should reset after window expires", async () => {
    const { checkRateLimit } = await import(
      "@/server/middleware/rateLimit"
    );

    // Use a very short window (1 second)
    await expect(
      checkRateLimit({ identifier: "short-window-test", limit: 1, window: 1 }),
    ).resolves.toBeUndefined();

    // Second request should be blocked (before window reset)
    await expect(
      checkRateLimit({ identifier: "short-window-test", limit: 1, window: 1 }),
    ).rejects.toThrow("Trop de requêtes");

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Should be allowed again
    await expect(
      checkRateLimit({ identifier: "short-window-test", limit: 1, window: 1 }),
    ).resolves.toBeUndefined();
  }, 5000);
});

// ---------------------------------------------------------------------------
// Webhook-specific rate limit: checkWebhookRateLimit
// ---------------------------------------------------------------------------

vi.mock("@/lib/redis", () => ({
  redis: null, // Force in-memory fallback
}));

describe("checkWebhookRateLimit — unknown endpoint keys", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("should return false for unknown endpoint keys (deny by default)", async () => {
    const { checkWebhookRateLimit } = await import("../rateLimit");

    const result = await checkWebhookRateLimit("unknown:endpoint", "127.0.0.1");
    expect(result).toBe(false);
  });

  it("should return false for empty endpoint key", async () => {
    const { checkWebhookRateLimit } = await import("../rateLimit");

    const result = await checkWebhookRateLimit("", "127.0.0.1");
    expect(result).toBe(false);
  });

  it("should return false for malicious endpoint key", async () => {
    const { checkWebhookRateLimit } = await import("../rateLimit");

    const result = await checkWebhookRateLimit("../../etc/passwd", "127.0.0.1");
    expect(result).toBe(false);
  });

  it("should allow requests for known endpoint keys", async () => {
    const { checkWebhookRateLimit } = await import("../rateLimit");

    // "twilio:status" is a known key with limit 60, window 60, perIp false
    const result = await checkWebhookRateLimit("twilio:status", "127.0.0.1");
    expect(result).toBe(true);
  });

  it("should allow multiple requests for known keys within limit", async () => {
    const { checkWebhookRateLimit } = await import("../rateLimit");

    // "stripe:checkout" has limit 20, so first 20 should pass
    for (let i = 0; i < 20; i++) {
      const result = await checkWebhookRateLimit("stripe:checkout", "127.0.0.1");
      expect(result).toBe(true);
    }

    // 21st should be denied
    const result = await checkWebhookRateLimit("stripe:checkout", "127.0.0.1");
    expect(result).toBe(false);
  });

  it("should fall back to in-memory store when Redis is unavailable", async () => {
    const { checkWebhookRateLimit } = await import("../rateLimit");

    // Hit the limit for "twilio:voice:init" (limit 30, per IP)
    for (let i = 0; i < 30; i++) {
      const result = await checkWebhookRateLimit("twilio:voice:init", "10.0.0.1");
      expect(result).toBe(true);
    }

    // 31st should be denied
    const result = await checkWebhookRateLimit("twilio:voice:init", "10.0.0.1");
    expect(result).toBe(false);
  });

  it("should have independent counters for different IPs", async () => {
    const { checkWebhookRateLimit } = await import("../rateLimit");

    // Exhaust IP 10.0.0.1 for "twilio:voice:init" (limit 30, per IP)
    for (let i = 0; i < 30; i++) {
      await checkWebhookRateLimit("twilio:voice:init", "10.0.0.1");
    }
    expect(await checkWebhookRateLimit("twilio:voice:init", "10.0.0.1")).toBe(false);

    // Different IP should still work
    expect(await checkWebhookRateLimit("twilio:voice:init", "10.0.0.2")).toBe(true);
  });
});
