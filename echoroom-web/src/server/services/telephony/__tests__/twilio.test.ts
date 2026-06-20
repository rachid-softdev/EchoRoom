import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// twilio.ts tests — client credentials, phone number, circuit breaker
// ---------------------------------------------------------------------------
// Tests for:
//   - twilioClient created with correct account SID and auth token
//   - TWILIO_PHONE exported from env
//   - twilioCircuitBreaker created via createTwilioCircuitBreaker

const mockTwilioFn = vi.fn(() => ({
  calls: { create: vi.fn() },
}));

vi.mock("twilio", () => ({
  default: mockTwilioFn,
}));

const mockCreateTwilioCircuitBreaker = vi.fn(() => ({
  call: vi.fn((fn: () => unknown) => fn()),
}));

vi.mock("@/server/lib/circuitBreaker", () => ({
  createTwilioCircuitBreaker: mockCreateTwilioCircuitBreaker,
}));

vi.mock("@/lib/env", () => ({
  env: {
    TWILIO_ACCOUNT_SID: "AC_test_account_sid_123",
    TWILIO_AUTH_TOKEN: "test_auth_token_456",
    TWILIO_PHONE_NUMBER: "+15551234567",
  },
}));

describe("twilio", () => {
  it("should create twilioClient with account SID and auth token", async () => {
    await import("../twilio");

    expect(mockTwilioFn).toHaveBeenCalledWith(
      "AC_test_account_sid_123",
      "test_auth_token_456",
      expect.objectContaining({ timeout: 10000 }),
    );
  });

  it("should expose TWILIO_PHONE from environment", async () => {
    const { TWILIO_PHONE } = await import("../twilio");

    expect(TWILIO_PHONE).toBe("+15551234567");
  });

  it("should create a circuit breaker for Twilio calls", async () => {
    await import("../twilio");

    expect(mockCreateTwilioCircuitBreaker).toHaveBeenCalledTimes(1);
  });

  it("should export twilioCircuitBreaker with a call method", async () => {
    const { twilioCircuitBreaker } = await import("../twilio");

    expect(twilioCircuitBreaker).toBeDefined();
    expect(typeof twilioCircuitBreaker.call).toBe("function");
  });

  it("should export twilioClient with calls.create method", async () => {
    const { twilioClient } = await import("../twilio");

    expect(twilioClient).toBeDefined();
    expect(typeof twilioClient.calls.create).toBe("function");
  });

  it("should pass timeout option as 10000ms", async () => {
    await import("../twilio");

    expect(mockTwilioFn).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ timeout: 10000 }),
    );
  });
});
