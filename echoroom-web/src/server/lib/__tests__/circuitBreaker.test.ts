import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
  createOpenAICircuitBreaker,
  createTwilioCircuitBreaker,
} from "../circuitBreaker";

// ---------------------------------------------------------------------------
// CircuitBreaker Tests
// ---------------------------------------------------------------------------

describe("CircuitBreaker", () => {
  let breaker: CircuitBreaker;
  let now = 0;

  beforeEach(() => {
    vi.useFakeTimers();
    now = 1000000;
    vi.setSystemTime(now);

    breaker = new CircuitBreaker(3, 2, 1000, "test-breaker");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // CLOSED state
  // -----------------------------------------------------------------------

  it("should call fn and return result in CLOSED state", async () => {
    const fn = vi.fn().mockResolvedValue("success");

    const result = await breaker.call(fn);

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should update stats after successful call", async () => {
    const fn = vi.fn().mockResolvedValue("ok");

    await breaker.call(fn);

    const stats = breaker.getStats();
    expect(stats.state).toBe("CLOSED");
    expect(stats.totalCalls).toBe(1);
    expect(stats.failureCount).toBe(0);
    expect(stats.successCount).toBe(0); // successCount only tracked in HALF_OPEN
    expect(stats.lastSuccess).toBe(now);
    expect(stats.lastFailure).toBeNull();
  });

  it("should update stats after failed call in CLOSED", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    await expect(breaker.call(fn)).rejects.toThrow("fail");

    const stats = breaker.getStats();
    expect(stats.state).toBe("CLOSED"); // only 1 failure, threshold is 3
    expect(stats.totalCalls).toBe(1);
    expect(stats.failureCount).toBe(1);
    expect(stats.lastFailure).toBe(now);
  });

  // -----------------------------------------------------------------------
  // CLOSED → OPEN transition
  // -----------------------------------------------------------------------

  it("should transition to OPEN after failureThreshold failures", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    // First two failures — still CLOSED
    await expect(breaker.call(fn)).rejects.toThrow("fail");
    await expect(breaker.call(fn)).rejects.toThrow("fail");
    expect(breaker.getStats().state).toBe("CLOSED");

    // Third failure — transitions to OPEN
    await expect(breaker.call(fn)).rejects.toThrow("fail");
    expect(breaker.getStats().state).toBe("OPEN");
    expect(breaker.getStats().failureCount).toBe(3);
    expect(breaker.getStats().totalCalls).toBe(3);
  });

  // -----------------------------------------------------------------------
  // OPEN state
  // -----------------------------------------------------------------------

  it("should throw CircuitBreakerOpenError when in OPEN state", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    // Trip the breaker
    await expect(breaker.call(fn)).rejects.toThrow("fail");
    await expect(breaker.call(fn)).rejects.toThrow("fail");
    await expect(breaker.call(fn)).rejects.toThrow("fail");
    expect(breaker.getStats().state).toBe("OPEN");

    // Now in OPEN — should throw CircuitBreakerOpenError without calling fn
    const fn2 = vi.fn().mockResolvedValue("should not be called");
    await expect(breaker.call(fn2)).rejects.toThrow(CircuitBreakerOpenError);
    expect(fn2).not.toHaveBeenCalled();
    expect(breaker.getStats().totalCalls).toBe(4);
  });

  // -----------------------------------------------------------------------
  // OPEN → HALF_OPEN transition (after timeout)
  // -----------------------------------------------------------------------

  it("should transition to HALF_OPEN after openTimeoutMs passes", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    // Trip the breaker
    await expect(breaker.call(fn)).rejects.toThrow("fail");
    await expect(breaker.call(fn)).rejects.toThrow("fail");
    await expect(breaker.call(fn)).rejects.toThrow("fail");
    expect(breaker.getStats().state).toBe("OPEN");

    // Advance time past timeout
    vi.advanceTimersByTime(1000);

    // Next call should transition to HALF_OPEN and call fn
    const fn2 = vi.fn().mockResolvedValue("recovered");
    const result = await breaker.call(fn2);

    expect(result).toBe("recovered");
    expect(breaker.getStats().state).toBe("HALF_OPEN");
    expect(fn2).toHaveBeenCalledTimes(1);
  });

  it("should remain OPEN when openTimeoutMs has NOT elapsed", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    // Trip the breaker
    await expect(breaker.call(fn)).rejects.toThrow("fail");
    await expect(breaker.call(fn)).rejects.toThrow("fail");
    await expect(breaker.call(fn)).rejects.toThrow("fail");
    expect(breaker.getStats().state).toBe("OPEN");

    // Advance time only partially
    vi.advanceTimersByTime(500);

    // Should still throw CircuitBreakerOpenError
    const fn2 = vi.fn().mockResolvedValue("should not be called");
    await expect(breaker.call(fn2)).rejects.toThrow(CircuitBreakerOpenError);
    expect(fn2).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // HALF_OPEN → CLOSED (success threshold reached)
  // -----------------------------------------------------------------------

  it("should transition to CLOSED after successThreshold successes in HALF_OPEN", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    // Trip the breaker (3 failures, threshold = 3)
    await expect(breaker.call(fn)).rejects.toThrow("fail");
    await expect(breaker.call(fn)).rejects.toThrow("fail");
    await expect(breaker.call(fn)).rejects.toThrow("fail");

    // Wait for timeout
    vi.advanceTimersByTime(1000);

    // First successful trial — HALF_OPEN (successCount=1, need 2)
    const fnOk1 = vi.fn().mockResolvedValue("ok1");
    await breaker.call(fnOk1);
    expect(breaker.getStats().state).toBe("HALF_OPEN");
    expect(breaker.getStats().successCount).toBe(1);

    // Second successful trial — transitions to CLOSED (successCount reaches threshold)
    const fnOk2 = vi.fn().mockResolvedValue("ok2");
    await breaker.call(fnOk2);
    expect(breaker.getStats().state).toBe("CLOSED");
    expect(breaker.getStats().successCount).toBe(0); // reset after transition
    expect(breaker.getStats().failureCount).toBe(0); // reset on success
  });

  // -----------------------------------------------------------------------
  // HALF_OPEN → OPEN (trial fails)
  // -----------------------------------------------------------------------

  it("should transition back to OPEN when trial fails in HALF_OPEN", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    // Trip the breaker
    await expect(breaker.call(fn)).rejects.toThrow("fail");
    await expect(breaker.call(fn)).rejects.toThrow("fail");
    await expect(breaker.call(fn)).rejects.toThrow("fail");

    // Wait for timeout
    vi.advanceTimersByTime(1000);

    // Trial attempt fails — back to OPEN
    await expect(breaker.call(fn)).rejects.toThrow("fail");
    expect(breaker.getStats().state).toBe("OPEN");
  });

  // -----------------------------------------------------------------------
  // getStats()
  // -----------------------------------------------------------------------

  it("getStats() should return correct stats", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    // Make 2 failures
    await expect(breaker.call(fn)).rejects.toThrow("fail");
    await expect(breaker.call(fn)).rejects.toThrow("fail");

    const stats = breaker.getStats();
    expect(stats).toEqual({
      state: "CLOSED",
      failureCount: 2,
      successCount: 0,
      totalCalls: 2,
      lastFailure: now,
      lastSuccess: null,
      openTimeoutMs: 1000,
      failureThreshold: 3,
      successThreshold: 2,
    });
  });

  it("getStats() should not leak mutable references", () => {
    const stats1 = breaker.getStats();
    const stats2 = breaker.getStats();
    // Each call should return a fresh object
    expect(stats1).not.toBe(stats2);
  });

  // -----------------------------------------------------------------------
  // reset()
  // -----------------------------------------------------------------------

  it("reset() should reset all state to CLOSED", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    // Trip to OPEN
    await expect(breaker.call(fn)).rejects.toThrow("fail");
    await expect(breaker.call(fn)).rejects.toThrow("fail");
    await expect(breaker.call(fn)).rejects.toThrow("fail");
    expect(breaker.getStats().state).toBe("OPEN");

    breaker.reset();

    const stats = breaker.getStats();
    expect(stats.state).toBe("CLOSED");
    expect(stats.failureCount).toBe(0);
    expect(stats.successCount).toBe(0);
    expect(stats.totalCalls).toBe(0);
    expect(stats.lastFailure).toBeNull();
    expect(stats.lastSuccess).toBeNull();

    // Should work normally after reset
    const fn2 = vi.fn().mockResolvedValue("after-reset");
    const result = await breaker.call(fn2);
    expect(result).toBe("after-reset");
    expect(breaker.getStats().totalCalls).toBe(1);
  });

  // -----------------------------------------------------------------------
  // Error propagation
  // -----------------------------------------------------------------------

  it("should propagate the original error from fn", async () => {
    const customError = new Error("custom error message");
    const fn = vi.fn().mockRejectedValue(customError);

    await expect(breaker.call(fn)).rejects.toThrow("custom error message");
  });

  it("should not call fn if breaker is OPEN (no elapsed)", async () => {
    const failFn = vi.fn().mockRejectedValue(new Error("fail"));

    // Trip to OPEN
    await expect(breaker.call(failFn)).rejects.toThrow("fail");
    await expect(breaker.call(failFn)).rejects.toThrow("fail");
    await expect(breaker.call(failFn)).rejects.toThrow("fail");

    const otherFn = vi.fn().mockResolvedValue("data");
    await expect(breaker.call(otherFn)).rejects.toThrow(CircuitBreakerOpenError);
    expect(otherFn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

describe("CircuitBreaker factories", () => {
  it("createTwilioCircuitBreaker should create with correct config", () => {
    const cb = createTwilioCircuitBreaker();
    const stats = cb.getStats();
    expect(stats.failureThreshold).toBe(5);
    expect(stats.successThreshold).toBe(3);
    expect(stats.openTimeoutMs).toBe(30_000);
  });

  it("createOpenAICircuitBreaker should create with correct config", () => {
    const cb = createOpenAICircuitBreaker();
    const stats = cb.getStats();
    expect(stats.failureThreshold).toBe(3);
    expect(stats.successThreshold).toBe(2);
    expect(stats.openTimeoutMs).toBe(15_000);
  });

  it("factory should return a working CircuitBreaker instance", () => {
    const cb = createTwilioCircuitBreaker();
    expect(cb).toBeInstanceOf(CircuitBreaker);
    expect(typeof cb.call).toBe("function");
    expect(typeof cb.getStats).toBe("function");
    expect(typeof cb.reset).toBe("function");
  });
});
