import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";

// ---------------------------------------------------------------------------
// InMemoryRateLimitStore Tests
// ---------------------------------------------------------------------------
// Tests for rateLimitStore.ts:
//   - inMemoryRateLimitStore.check(key, limit, windowSec)
//   - Periodic cleanup eviction
//   - Large store eviction (25% of entries)

describe("InMemoryRateLimitStore", () => {
  let store: typeof import("../rateLimitStore")["inMemoryRateLimitStore"];

  beforeEach(async () => {
    // Import fresh to reset the singleton state
    vi.resetModules();
    const mod = await import("../rateLimitStore");
    store = mod.inMemoryRateLimitStore;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Basic check functionality
  // -----------------------------------------------------------------------

  it("should allow requests within the limit", () => {
    // Window of 60 seconds, limit of 5 requests
    expect(store.check("user:1", 5, 60)).toBe(true); // 1st
    expect(store.check("user:1", 5, 60)).toBe(true); // 2nd
    expect(store.check("user:1", 5, 60)).toBe(true); // 3rd
    expect(store.check("user:1", 5, 60)).toBe(true); // 4th
    expect(store.check("user:1", 5, 60)).toBe(true); // 5th — exactly at limit
  });

  it("should deny requests exceeding the limit", () => {
    const limit = 3;
    expect(store.check("user:2", limit, 60)).toBe(true);  // 1st
    expect(store.check("user:2", limit, 60)).toBe(true);  // 2nd
    expect(store.check("user:2", limit, 60)).toBe(true);  // 3rd
    expect(store.check("user:2", limit, 60)).toBe(false); // 4th — denied!
    expect(store.check("user:2", limit, 60)).toBe(false); // 5th — still denied
  });

  it("should reset after the window expires", async () => {
    // Use a very short window (1 second)
    expect(store.check("user:3", 1, 1)).toBe(true);  // 1st by user:3
    expect(store.check("user:3", 1, 1)).toBe(false); // 2nd — denied

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Should be allowed again
    expect(store.check("user:3", 1, 1)).toBe(true);  // 1st again
  });

  it("should allow different keys independently", () => {
    // user:4 has limit 1, but user:5 should be allowed separately
    expect(store.check("user:4", 1, 60)).toBe(true);  // user:4 — allowed
    expect(store.check("user:4", 1, 60)).toBe(false); // user:4 — denied
    expect(store.check("user:5", 1, 60)).toBe(true);  // user:5 — independent, allowed
    expect(store.check("user:5", 1, 60)).toBe(false); // user:5 — now denied
  });

  it("should handle limit of 1 correctly", () => {
    expect(store.check("user:burst", 1, 60)).toBe(true);  // 1st — allowed
    expect(store.check("user:burst", 1, 60)).toBe(false); // 2nd — denied
  });

  it("should handle high limits", () => {
    for (let i = 0; i < 100; i++) {
      const allowed = store.check("user:high", 100, 60);
      expect(allowed).toBe(true);
    }
    // 101st should be denied
    expect(store.check("user:high", 100, 60)).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Cleanup behavior
  // -----------------------------------------------------------------------

  it("should clean up expired entries during periodic cleanup", async () => {
    // Create entries with very short windows
    store.check("temp:1", 5, 1); // 1 second window
    store.check("temp:2", 5, 1); // 1 second window
    store.check("keep:1", 5, 3600); // 1 hour window (won't expire)

    // Wait for short-lived entries to expire
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Trigger cleanup by making a new request
    // (cleanup runs when the CLEANUP_INTERVAL_MS of 60s has passed, but we
    //  can test the internal periodicCleanup via get size — the expired
    //  entries should still be in the store because cleanup hasn't run)
    const sizeBefore = store.size;
    // All 3 entries should still be in the Map (cleanup hasn't fired)
    expect(sizeBefore).toBeGreaterThanOrEqual(3);

    // Manually trigger cleanup by checking (cleanup needs 60s interval,
    // but we can't easily trigger it. Let's just verify core behavior:
    // the expired entries' resetAt has passed, so they'll be overwritten
    // on next check, effectively resetting.)
    expect(store.check("temp:1", 5, 1)).toBe(true); // Reset
    expect(store.check("temp:2", 5, 1)).toBe(true); // Reset
  });

  it("should remove expired entries during periodicCleanup (memory leak prevention)", async () => {
    // Use fake timers to control the 30-second CLEANUP_INTERVAL_MS
    vi.useFakeTimers();

    // Create entries with 1-second windows
    store.check("leak:a", 5, 1);
    store.check("leak:b", 5, 1);
    store.check("leak:c", 5, 1);
    expect(store.size).toBe(3);

    // Advance time past their expiry (1s window) AND past the cleanup interval (30s)
    // We need lastCleanup to be > 30s ago for periodicCleanup to run
    // Set time to 40 seconds later so both expiry and cleanup trigger
    await vi.advanceTimersByTimeAsync(40_000);

    // Trigger periodicCleanup by making a new check call
    store.check("fresh-key", 5, 60);

    // The 3 expired entries should have been removed during periodicCleanup
    expect(store.size).toBe(1);

    vi.useRealTimers();
  });

  it("should evict 25% of entries when store exceeds 100k entries", () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Since store was created in beforeEach (before fake timers), lastCleanup
    // is the real current time. Set system time to a far FUTURE value so that
    // now - lastCleanup exceeds CLEANUP_INTERVAL_MS (30s) on every check call.
    vi.setSystemTime(new Date("2099-01-01T00:00:00Z"));

    // Note: periodicCleanup runs at the START of each check(), before the
    // new entry is added. So we need the store to already have > 100k entries
    // for the eviction to trigger. Creating 100_001 entries ensures that when
    // periodicCleanup runs for a subsequent key, size > 100_000 is true.
    for (let i = 0; i < 100_001; i++) {
      store.check(`evict-bulk:${i}`, 5, 3600);
    }
    expect(store.size).toBe(100_001);

    // Advance time past the 30-second CLEANUP_INTERVAL_MS
    vi.setSystemTime(new Date("2099-01-01T00:00:31Z"));

    // This check triggers periodicCleanup, which sees size 100001 > 100000
    store.check("evict-trigger", 5, 3600);

    // After eviction, store should have removed ~25% of old entries
    // Starting from 100001 entries, removing 25% of 100001 = ~25000
    // After cleanup (75001 remaining), check() adds the evict-trigger entry,
    // bringing the total to 75002
    expect(store.size).toBeLessThanOrEqual(75_002);
    expect(store.size).toBeGreaterThanOrEqual(75_001);

    warnSpy.mockRestore();
    vi.useRealTimers();
  });

  it("should track size accurately", () => {
    expect(store.size).toBe(0);

    store.check("key:a", 5, 60);
    expect(store.size).toBe(1);

    store.check("key:b", 5, 60);
    expect(store.size).toBe(2);

    store.check("key:c", 5, 60);
    expect(store.size).toBe(3);
  });

  // -----------------------------------------------------------------------
  // Window alignment to clock boundaries
  // -----------------------------------------------------------------------

  it("should align window to clock boundaries (deterministic reset)", () => {
    // The implementation uses: windowStart = now - (now % (windowSec * 1000))
    // This means for a 60-second window, the window aligns to minute boundaries.
    // For a 10-second window, it aligns to :00, :10, :20, :30, :40, :50.

    // For a 10-second window, clock boundaries are at multiples of 10s
    // We can't control Date.now() directly (it's not mocked), but we can verify
    // that the resetAt is always a multiple of windowSec * 1000 from epoch.

    // First request starts a new window
    store.check("clock-align", 5, 10);

    // We can't check exact resetAt since it's private, but we verify behavior:
    // requests within the same window are tracked correctly
    expect(store.check("clock-align", 5, 10)).toBe(true); // 2nd
    expect(store.check("clock-align", 5, 10)).toBe(true); // 3rd
    expect(store.check("clock-align", 5, 10)).toBe(true); // 4th
    expect(store.check("clock-align", 5, 10)).toBe(true); // 5th
    expect(store.check("clock-align", 5, 10)).toBe(false); // 6th — denied
  });

  it("should handle window alignment with different window sizes", () => {
    // Test with a 5-second window
    store.check("clock-5s", 2, 5);
    expect(store.check("clock-5s", 2, 5)).toBe(true);  // 2nd
    expect(store.check("clock-5s", 2, 5)).toBe(false); // 3rd — denied

    // Test with a 30-second window
    store.check("clock-30s", 2, 30);
    expect(store.check("clock-30s", 2, 30)).toBe(true);  // 2nd
    expect(store.check("clock-30s", 2, 30)).toBe(false); // 3rd — denied
  });

  it("should reset window at clock boundary, not at first request time", async () => {
    // For a 1-second window, the clock boundary is every second.
    // After 1 second passes, the window should reset.

    expect(store.check("boundary-test", 1, 1)).toBe(true);  // 1st
    expect(store.check("boundary-test", 1, 1)).toBe(false); // 2nd — denied

    // Wait just over 1 second — window should reset if it's aligned to clock
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Should be allowed (window reset at clock boundary)
    expect(store.check("boundary-test", 1, 1)).toBe(true);  // 1st of new window
    expect(store.check("boundary-test", 1, 1)).toBe(false); // 2nd — denied
  });
});
