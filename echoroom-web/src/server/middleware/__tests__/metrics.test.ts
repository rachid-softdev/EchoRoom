import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// RED Metrics Middleware Tests
// ---------------------------------------------------------------------------
// Tests for withREDMetrics middleware:
//   - Calls next() and returns result on success
//   - Captures duration and logs it
//   - Calls trackEvent on success
//   - Calls trackEvent on error
//   - Re-throws errors
//   - getREDMetrics() returns correct counters
//   - Handles null posthog gracefully

// Use a persistent logger instance — clearAllMocks will clear call history
// but the object reference stays valid.
const mockLogInstance = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => mockLogInstance),
}));

const mockTrackEvent = vi.fn().mockResolvedValue(undefined);

vi.mock("@/server/services/analytics/events", () => ({
  trackEvent: mockTrackEvent,
}));

// Mock tRPC middleware to just return the inner function (unwrap wrapper)
vi.mock("@/server/trpc", () => {
  const chain = {
    use: vi.fn(() => chain),
  };
  return {
    middleware: vi.fn((fn: Function) => fn),
    t: { procedure: chain },
  };
});

describe("withREDMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Successful requests
  // -----------------------------------------------------------------------

  it("should call next() and return result on success", async () => {
    const { withREDMetrics } = await import("../metrics");

    const expectedResult = { data: "hello" };
    const next = vi.fn().mockResolvedValue(expectedResult);

    const result = await withREDMetrics({
      ctx: { session: { user: { id: "user-1" } } },
      next,
      path: "scenario.list",
      type: "query",
    });

    expect(result).toBe(expectedResult);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should capture duration and log it on success", async () => {
    const { withREDMetrics } = await import("../metrics");

    const next = vi.fn().mockResolvedValue({ ok: true });

    await withREDMetrics({
      ctx: { session: null },
      next,
      path: "test.procedure",
      type: "mutation",
    });

    expect(mockLogInstance.info).toHaveBeenCalledWith(
      "TRPC request",
      expect.objectContaining({
        endpoint: "mutation:test.procedure",
        status: "success",
      }),
    );
  });

  it("should call trackEvent on success", async () => {
    const { withREDMetrics } = await import("../metrics");

    const next = vi.fn().mockResolvedValue({ ok: true });

    await withREDMetrics({
      ctx: { session: { user: { id: "user-123" } } },
      next,
      path: "scenario.get",
      type: "query",
    });

    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith({
      event: "trpc_request",
      userId: "user-123",
      properties: expect.objectContaining({
        endpoint: "scenario.get",
        type: "query",
        status: "success",
      }),
    });
  });

  it("should call trackEvent with undefined userId when no session", async () => {
    const { withREDMetrics } = await import("../metrics");

    const next = vi.fn().mockResolvedValue({ ok: true });

    await withREDMetrics({
      ctx: { session: null },
      next,
      path: "public.endpoint",
      type: "query",
    });

    expect(mockTrackEvent).toHaveBeenCalledWith({
      event: "trpc_request",
      userId: undefined,
      properties: expect.objectContaining({
        status: "success",
      }),
    });
  });

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------

  it("should call trackEvent on error", async () => {
    const { withREDMetrics } = await import("../metrics");

    const testError = new Error("Something went wrong");
    const next = vi.fn().mockRejectedValue(testError);

    await expect(
      withREDMetrics({
        ctx: { session: { user: { id: "user-error" } } },
        next,
        path: "failing.endpoint",
        type: "mutation",
      }),
    ).rejects.toThrow("Something went wrong");

    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith({
      event: "trpc_request",
      userId: "user-error",
      properties: expect.objectContaining({
        endpoint: "failing.endpoint",
        type: "mutation",
        status: "error",
      }),
    });
  });

  it("should re-throw errors (does NOT swallow)", async () => {
    const { withREDMetrics } = await import("../metrics");

    const testError = new Error("Critical failure");
    const next = vi.fn().mockRejectedValue(testError);

    await expect(
      withREDMetrics({
        ctx: { session: null },
        next,
        path: "critical.path",
        type: "query",
      }),
    ).rejects.toThrow("Critical failure");
  });

  it("should log error information on failure", async () => {
    const { withREDMetrics } = await import("../metrics");

    const testError = new Error("Log me");
    const next = vi.fn().mockRejectedValue(testError);

    await expect(
      withREDMetrics({
        ctx: { session: null },
        next,
        path: "error.path",
        type: "mutation",
      }),
    ).rejects.toThrow("Log me");

    expect(mockLogInstance.info).toHaveBeenCalledWith(
      "TRPC request",
      expect.objectContaining({
        endpoint: "mutation:error.path",
        status: "error",
      }),
    );
  });

  // -----------------------------------------------------------------------
  // getREDMetrics() — in-memory counters
  // -----------------------------------------------------------------------

  it("getREDMetrics() should return correct counters after calls", async () => {
    const { withREDMetrics, getREDMetrics } = await import("../metrics");

    const nextOk = vi.fn().mockResolvedValue({ ok: true });

    // Make 3 successful calls
    await withREDMetrics({
      ctx: { session: null },
      next: nextOk,
      path: "test.endpoint",
      type: "query",
    });
    await withREDMetrics({
      ctx: { session: null },
      next: nextOk,
      path: "test.endpoint",
      type: "query",
    });
    await withREDMetrics({
      ctx: { session: null },
      next: nextOk,
      path: "test.endpoint",
      type: "query",
    });

    const metrics = getREDMetrics();
    expect(metrics["query:test.endpoint"]).toBeDefined();
    expect(metrics["query:test.endpoint"].calls).toBe(3);
    expect(metrics["query:test.endpoint"].errors).toBe(0);
    expect(metrics["query:test.endpoint"].totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("getREDMetrics() should track errors separately", async () => {
    const { withREDMetrics, getREDMetrics } = await import("../metrics");

    const nextErr = vi.fn().mockRejectedValue(new Error("fail"));

    await expect(
      withREDMetrics({
        ctx: { session: null },
        next: nextErr,
        path: "error.test",
        type: "query",
      }),
    ).rejects.toThrow("fail");

    const metrics = getREDMetrics();
    expect(metrics["query:error.test"]).toBeDefined();
    expect(metrics["query:error.test"].calls).toBe(1);
    expect(metrics["query:error.test"].errors).toBe(1);
  });

  it("should increment counters on multiple calls to different endpoints", async () => {
    const { withREDMetrics, getREDMetrics } = await import("../metrics");

    const nextOk = vi.fn().mockResolvedValue({ ok: true });
    const nextErr = vi.fn().mockRejectedValue(new Error("fail"));

    // Endpoint A: 2 successes
    await withREDMetrics({ ctx: { session: null }, next: nextOk, path: "a", type: "query" });
    await withREDMetrics({ ctx: { session: null }, next: nextOk, path: "a", type: "query" });

    // Endpoint B: 1 success, 1 error
    await withREDMetrics({ ctx: { session: null }, next: nextOk, path: "b", type: "mutation" });
    await expect(
      withREDMetrics({ ctx: { session: null }, next: nextErr, path: "b", type: "mutation" }),
    ).rejects.toThrow("fail");

    const metrics = getREDMetrics();
    expect(metrics["query:a"].calls).toBe(2);
    expect(metrics["query:a"].errors).toBe(0);
    expect(metrics["mutation:b"].calls).toBe(2);
    expect(metrics["mutation:b"].errors).toBe(1);
  });

  it("getREDMetrics() should return a snapshot (not a live reference)", async () => {
    const { withREDMetrics, getREDMetrics } = await import("../metrics");

    const nextOk = vi.fn().mockResolvedValue({ ok: true });
    await withREDMetrics({ ctx: { session: null }, next: nextOk, path: "snapshot.test", type: "query" });

    const snapshot = getREDMetrics();
    // Modify the snapshot
    snapshot["query:snapshot.test"] = { calls: 999, errors: 999, totalDurationMs: 999 };

    // Original should be unchanged
    const metrics = getREDMetrics();
    expect(metrics["query:snapshot.test"].calls).toBe(1);
    expect(metrics["query:snapshot.test"].errors).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Null posthog handling (via trackEvent mock)
  // -----------------------------------------------------------------------

  it("should not throw when trackEvent mock throws", async () => {
    mockTrackEvent.mockRejectedValueOnce(new Error("PostHog unavailable"));

    const { withREDMetrics } = await import("../metrics");

    const next = vi.fn().mockResolvedValue({ ok: true });

    // Should not throw even if trackEvent fails (fire-and-forget catch)
    await expect(
      withREDMetrics({
        ctx: { session: null },
        next,
        path: "resilient.path",
        type: "query",
      }),
    ).resolves.toEqual({ ok: true });
  });
});
