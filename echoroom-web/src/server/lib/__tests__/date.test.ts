import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// getUTCDateString & getUTCDayRange — Date utility tests
// ---------------------------------------------------------------------------
// Pure functions: no mocking needed.
// Tests validate format, correctness, and boundary conditions.

const YYYY_MM_DD_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

describe("getUTCDateString", () => {
  it("should return a string matching YYYY-MM-DD format", async () => {
    const { getUTCDateString } = await import("../date");
    const result = getUTCDateString();
    expect(result).toMatch(YYYY_MM_DD_REGEX);
  });

  it("should return the current UTC date", async () => {
    const { getUTCDateString } = await import("../date");
    const result = getUTCDateString();

    // Build the expected string from current UTC time
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const day = String(now.getUTCDate()).padStart(2, "0");
    const expected = `${year}-${month}-${day}`;

    expect(result).toBe(expected);
  });

  it("should return consistent results within the same millisecond", async () => {
    const { getUTCDateString } = await import("../date");
    // Two calls in rapid succession should produce the same result
    const result1 = getUTCDateString();
    const result2 = getUTCDateString();
    expect(result1).toBe(result2);
  });

  it("should have month in range 01-12", async () => {
    const { getUTCDateString } = await import("../date");
    const result = getUTCDateString();
    const month = result.split("-")[1];
    expect(Number(month)).toBeGreaterThanOrEqual(1);
    expect(Number(month)).toBeLessThanOrEqual(12);
  });

  it("should have day in range 01-31", async () => {
    const { getUTCDateString } = await import("../date");
    const result = getUTCDateString();
    const day = result.split("-")[2];
    expect(Number(day)).toBeGreaterThanOrEqual(1);
    expect(Number(day)).toBeLessThanOrEqual(31);
  });
});

describe("getUTCDayRange", () => {
  it("should return todayStart at 00:00:00.000 UTC", async () => {
    const { getUTCDayRange } = await import("../date");
    const { todayStart } = getUTCDayRange();

    expect(todayStart).toBeInstanceOf(Date);
    expect(todayStart.getUTCHours()).toBe(0);
    expect(todayStart.getUTCMinutes()).toBe(0);
    expect(todayStart.getUTCSeconds()).toBe(0);
    expect(todayStart.getUTCMilliseconds()).toBe(0);
  });

  it("should return todayEnd at 23:59:59.999 UTC", async () => {
    const { getUTCDayRange } = await import("../date");
    const { todayEnd } = getUTCDayRange();

    expect(todayEnd).toBeInstanceOf(Date);
    expect(todayEnd.getUTCHours()).toBe(23);
    expect(todayEnd.getUTCMinutes()).toBe(59);
    expect(todayEnd.getUTCSeconds()).toBe(59);
    expect(todayEnd.getUTCMilliseconds()).toBe(999);
  });

  it("should return dates for today (same UTC date)", async () => {
    const { getUTCDayRange } = await import("../date");
    const { todayStart, todayEnd } = getUTCDayRange();

    const now = new Date();
    const currentUTCDate = now.getUTCDate();
    const currentUTCMonth = now.getUTCMonth();
    const currentUTCYear = now.getUTCFullYear();

    expect(todayStart.getUTCFullYear()).toBe(currentUTCYear);
    expect(todayStart.getUTCMonth()).toBe(currentUTCMonth);
    expect(todayStart.getUTCDate()).toBe(currentUTCDate);

    expect(todayEnd.getUTCFullYear()).toBe(currentUTCYear);
    expect(todayEnd.getUTCMonth()).toBe(currentUTCMonth);
    expect(todayEnd.getUTCDate()).toBe(currentUTCDate);
  });

  it("should ensure todayEnd is after todayStart", async () => {
    const { getUTCDayRange } = await import("../date");
    const { todayStart, todayEnd } = getUTCDayRange();

    expect(todayEnd.getTime()).toBeGreaterThan(todayStart.getTime());
  });

  it("should ensure the range is exactly 24 hours minus 1 millisecond", async () => {
    const { getUTCDayRange } = await import("../date");
    const { todayStart, todayEnd } = getUTCDayRange();

    // 24 hours in ms = 86400000, minus 1ms = 86399999
    const diff = todayEnd.getTime() - todayStart.getTime();
    expect(diff).toBe(86399999);
  });

  it("should return Date objects (not strings or numbers)", async () => {
    const { getUTCDayRange } = await import("../date");
    const range = getUTCDayRange();

    expect(range.todayStart).toBeInstanceOf(Date);
    expect(range.todayEnd).toBeInstanceOf(Date);
    expect(typeof range.todayStart.getTime).toBe("function");
    expect(typeof range.todayEnd.getTime).toBe("function");
  });
});
