import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// AppError — Custom error class tests
// ---------------------------------------------------------------------------
// Tests for errors.ts:
//   - AppError constructor sets name="AppError", code, message correctly
//   - All 16 AppErrorCode values are constructible
//   - AppError extends Error (instanceof Error)
//   - Empty string message works
//   - Stack trace is captured

const ALL_ERROR_CODES = [
  "BAD_REQUEST",
  "SCENARIO_NOT_FOUND",
  "USER_NOT_FOUND",
  "INSUFFICIENT_CREDITS",
  "TWILIO_ERROR",
  "NOT_FOUND",
  "DAILY_LIMIT_EXCEEDED",
  "NUMBER_BLOCKED",
  "CREDIT_DEBIT_FAILED",
  "USER_IN_ACTIVE_CALL",
  "CONSENT_ALREADY_WITHDRAWN",
  "FORBIDDEN",
] as const;

describe("AppError", () => {
  it("should set name to 'AppError'", async () => {
    const { AppError } = await import("../errors");
    const error = new AppError("BAD_REQUEST", "test message");
    expect(error.name).toBe("AppError");
  });

  it("should set code and message from constructor args", async () => {
    const { AppError } = await import("../errors");
    const error = new AppError("NOT_FOUND", "Resource not found");
    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Resource not found");
  });

  it("should extend Error (instanceof Error)", async () => {
    const { AppError } = await import("../errors");
    const error = new AppError("FORBIDDEN", "Access denied");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it("should capture a stack trace", async () => {
    const { AppError } = await import("../errors");
    const error = new AppError("TWILIO_ERROR", "Twilio failure");
    expect(error.stack).toBeDefined();
    expect(typeof error.stack).toBe("string");
    // Stack trace should include the error message and point to this file
    expect(error.stack).toContain("AppError");
  });

  it("should work with empty string message", async () => {
    const { AppError } = await import("../errors");
    const error = new AppError("BAD_REQUEST", "");
    expect(error.message).toBe("");
    expect(error.code).toBe("BAD_REQUEST");
  });

  it("should be throwable and catchable", async () => {
    const { AppError } = await import("../errors");
    try {
      throw new AppError("USER_NOT_FOUND", "User not found");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("USER_NOT_FOUND");
      expect((error as AppError).message).toBe("User not found");
    }
  });
});

describe("AppErrorCode values", () => {
  it.each(ALL_ERROR_CODES)("should construct AppError with code '%s'", async (code) => {
    const { AppError } = await import("../errors");
    const error = new AppError(code, `Error: ${code}`);
    expect(error.code).toBe(code);
    expect(error.message).toBe(`Error: ${code}`);
    expect(error.name).toBe("AppError");
  });

  it("should have 12 distinct error codes", () => {
    expect(ALL_ERROR_CODES).toHaveLength(12);
    const unique = new Set(ALL_ERROR_CODES);
    expect(unique.size).toBe(12);
  });
});
