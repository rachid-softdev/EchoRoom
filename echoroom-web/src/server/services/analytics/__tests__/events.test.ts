import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// L-6: posthog-node server analytics
// ---------------------------------------------------------------------------
// Tests that:
//   - Server-side events use the PostHog instance from @/lib/posthog-server
//   - trackEvent handles null posthog gracefully (no crash)
//   - identifyUser handles null posthog gracefully (no crash)
//   - Events are properly captured with correct structure (object-style API)

const mockFlushPosthog = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/posthog-server", () => ({
  posthog: null as { capture: ReturnType<typeof vi.fn>; identify: ReturnType<typeof vi.fn> } | null,
  flushPosthog: mockFlushPosthog,
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

function createMockPosthog() {
  return {
    capture: vi.fn(),
    identify: vi.fn(),
  };
}

describe("L-6: trackEvent — null posthog handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not throw when posthog is null", async () => {
    const { trackEvent } = await import("../events");

    expect(() => {
      trackEvent({
        event: "test_event",
        userId: "user-1",
        properties: { key: "value" },
      });
    }).not.toThrow();
  });

  it("should not throw when posthog is null and no userId provided", async () => {
    const { trackEvent } = await import("../events");

    expect(() => {
      trackEvent({
        event: "anonymous_event",
        properties: { source: "test" },
      });
    }).not.toThrow();
  });
});

describe("L-6: identifyUser — null posthog handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not throw when posthog is null", async () => {
    const { identifyUser } = await import("../events");

    expect(() => {
      identifyUser("user-1", { role: "USER" });
    }).not.toThrow();
  });

  it("should not throw when posthog is null and no traits provided", async () => {
    const { identifyUser } = await import("../events");

    expect(() => {
      identifyUser("user-1");
    }).not.toThrow();
  });
});

describe("L-6: events with PostHog active", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module cache so events.ts re-evaluates its import from posthog-server
    vi.resetModules();
  });

  it("should call posthog.capture when posthog is available", async () => {
    const mockPosthog = createMockPosthog();

    vi.doMock("@/lib/posthog-server", () => ({
      posthog: mockPosthog,
    }));

    const { trackEvent } = await import("../events");

    trackEvent({
      event: "user_action",
      userId: "user-123",
      properties: { action: "login" },
    });

    // Object-style API: capture({ distinctId, event, properties })
    expect(mockPosthog.capture).toHaveBeenCalledWith({
      distinctId: "user-123",
      event: "user_action",
      properties: { action: "login" },
    });
  });

  it("should use 'anonymous' as distinct_id when userId is not provided", async () => {
    const mockPosthog = createMockPosthog();

    vi.doMock("@/lib/posthog-server", () => ({
      posthog: mockPosthog,
    }));

    const { trackEvent } = await import("../events");

    trackEvent({
      event: "page_view",
      properties: { page: "/home" },
    });

    expect(mockPosthog.capture).toHaveBeenCalledWith({
      distinctId: "anonymous",
      event: "page_view",
      properties: { page: "/home" },
    });
  });

  it("should call posthog.identify when posthog is available", async () => {
    const mockPosthog = createMockPosthog();

    vi.doMock("@/lib/posthog-server", () => ({
      posthog: mockPosthog,
    }));

    const { identifyUser } = await import("../events");

    identifyUser("user-456", { role: "ADMIN", tier: "premium" });

    expect(mockPosthog.identify).toHaveBeenCalledWith({
      distinctId: "user-456",
      properties: { role: "ADMIN", tier: "premium" },
    });
  });

  it("should not throw when posthog.capture throws", async () => {
    const mockPosthog = {
      capture: vi.fn(() => {
        throw new Error("PostHog error");
      }),
      identify: vi.fn(),
    };

    vi.doMock("@/lib/posthog-server", () => ({
      posthog: mockPosthog,
    }));

    const { trackEvent } = await import("../events");

    expect(() => {
      trackEvent({
        event: "error_event",
        userId: "user-1",
      });
    }).not.toThrow();
  });

  // -----------------------------------------------------------------------
  // Flush behavior tests
  // -----------------------------------------------------------------------

  it("should call flushPosthog after trackEvent capture", async () => {
    const mockPosthog = createMockPosthog();
    const flushFn = vi.fn().mockResolvedValue(undefined);

    vi.doMock("@/lib/posthog-server", () => ({
      posthog: mockPosthog,
      flushPosthog: flushFn,
    }));

    const { trackEvent } = await import("../events");

    await trackEvent({
      event: "test_flush",
      userId: "user-1",
      properties: { key: "value" },
    });

    expect(mockPosthog.capture).toHaveBeenCalledTimes(1);
    expect(flushFn).toHaveBeenCalledTimes(1);
  });

  it("should call flushPosthog after identifyUser", async () => {
    const mockPosthog = createMockPosthog();
    const flushFn = vi.fn().mockResolvedValue(undefined);

    vi.doMock("@/lib/posthog-server", () => ({
      posthog: mockPosthog,
      flushPosthog: flushFn,
    }));

    const { identifyUser } = await import("../events");

    await identifyUser("user-456", { role: "ADMIN" });

    expect(mockPosthog.identify).toHaveBeenCalledTimes(1);
    expect(flushFn).toHaveBeenCalledTimes(1);
  });

  it("should not crash when flushPosthog throws", async () => {
    const mockPosthog = createMockPosthog();
    const flushFn = vi.fn().mockRejectedValue(new Error("Flush failed"));

    vi.doMock("@/lib/posthog-server", () => ({
      posthog: mockPosthog,
      flushPosthog: flushFn,
    }));

    const { trackEvent } = await import("../events");

    await expect(
      trackEvent({
        event: "flush_error",
        userId: "user-1",
      }),
    ).resolves.toBeUndefined();

    expect(mockPosthog.capture).toHaveBeenCalledTimes(1);
    expect(flushFn).toHaveBeenCalledTimes(1);
  });
});
