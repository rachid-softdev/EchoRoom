import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Twilio Webhook Signature Validation Tests (M3.2d)
// ---------------------------------------------------------------------------
// These tests verify the Twilio webhook signature validation middleware
// at app/api/webhooks/twilio/validate.ts that protects the /api/webhooks/twilio
// endpoint from forged requests.
//
// The validation uses Twilio's validateRequest() which verifies:
//   1. The X-Twilio-Signature header exists
//   2. The signature matches the HMAC-SHA1 of (url + params) signed with AuthToken

vi.mock("@/lib/env", () => ({
  env: {
    TWILIO_AUTH_TOKEN: "test_auth_token_for_validation",
  },
}));

// Mock the twilio SDK's validateRequest to control responses
const mockValidateRequest = vi.fn();
vi.mock("twilio", () => ({
  default: Object.assign(vi.fn(), { validateRequest: mockValidateRequest }),
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  })),
}));

function createMockReq(headers: Record<string, string | null>): NextRequest {
  return {
    headers: {
      get: (name: string) => headers[name] ?? null,
    },
    url: "https://api.echoroom.app/api/webhooks/twilio",
  } as unknown as NextRequest;
}

describe("validateTwilioRequest — signature validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return true when signature is valid", async () => {
    mockValidateRequest.mockReturnValue(true);

    const { validateTwilioRequest } = await import("@/app/api/webhooks/twilio/validate");

    const req = createMockReq({ "x-twilio-signature": "valid_signature==" });
    const result = validateTwilioRequest(req, { CallSid: "CA123", CallStatus: "completed" });

    expect(result).toBe(true);
    expect(mockValidateRequest).toHaveBeenCalledWith(
      "test_auth_token_for_validation",
      "valid_signature==",
      "https://api.echoroom.app/api/webhooks/twilio",
      { CallSid: "CA123", CallStatus: "completed" },
    );
  });

  it("should return false when signature is invalid", async () => {
    mockValidateRequest.mockReturnValue(false);

    const { validateTwilioRequest } = await import("@/app/api/webhooks/twilio/validate");

    const req = createMockReq({ "x-twilio-signature": "invalid_signature==" });
    const result = validateTwilioRequest(req, { CallSid: "CA123" });

    expect(result).toBe(false);
  });

  it("should return false when X-Twilio-Signature header is missing", async () => {
    const { validateTwilioRequest } = await import("@/app/api/webhooks/twilio/validate");

    const req = createMockReq({});
    const result = validateTwilioRequest(req, { CallSid: "CA123" });

    expect(result).toBe(false);
    expect(mockValidateRequest).not.toHaveBeenCalled();
  });

  it("should handle empty params gracefully", async () => {
    mockValidateRequest.mockReturnValue(true);

    const { validateTwilioRequest } = await import("@/app/api/webhooks/twilio/validate");

    const req = createMockReq({ "x-twilio-signature": "sig" });
    const result = validateTwilioRequest(req, {});

    expect(result).toBe(true);
    expect(mockValidateRequest).toHaveBeenCalledWith(
      expect.any(String),
      "sig",
      "https://api.echoroom.app/api/webhooks/twilio",
      {},
    );
  });

  it("should use the request URL for signature computation", async () => {
    mockValidateRequest.mockReturnValue(true);

    const { validateTwilioRequest } = await import("@/app/api/webhooks/twilio/validate");

    const req = {
      headers: {
        get: (name: string) => name === "x-twilio-signature" ? "sig" : null,
      },
      url: "https://api.echoroom.app/api/webhooks/twilio?customParam=test",
    } as unknown as NextRequest;

    const result = validateTwilioRequest(req, { CallStatus: "completed" });

    expect(result).toBe(true);
    expect(mockValidateRequest).toHaveBeenCalledWith(
      expect.any(String),
      "sig",
      "https://api.echoroom.app/api/webhooks/twilio?customParam=test",
      { CallStatus: "completed" },
    );
  });

  it("should reject requests with empty signature string", async () => {
    const { validateTwilioRequest } = await import("@/app/api/webhooks/twilio/validate");

    const req = createMockReq({ "x-twilio-signature": "" });
    const result = validateTwilioRequest(req, {});

    expect(result).toBe(false);
    expect(mockValidateRequest).not.toHaveBeenCalled();
  });

  it("should call twilio.validateRequest as a typed method (not via `as any`)", async () => {
    mockValidateRequest.mockReturnValue(true);

    const { validateTwilioRequest } = await import("@/app/api/webhooks/twilio/validate");

    const req = createMockReq({ "x-twilio-signature": "valid_sig" });
    const result = validateTwilioRequest(req, { CallSid: "CA123" });

    expect(result).toBe(true);
    expect(mockValidateRequest).toHaveBeenCalled();

    // Verify the call uses proper typed parameters
    const callArgs = mockValidateRequest.mock.calls[0];
    expect(callArgs[0]).toBe("test_auth_token_for_validation");
    expect(typeof callArgs[0]).toBe("string");
    expect(typeof callArgs[1]).toBe("string");
    expect(typeof callArgs[2]).toBe("string");
    expect(typeof callArgs[3]).toBe("object");
  });

  it("should handle non-ASCII characters in params without crashing", async () => {
    mockValidateRequest.mockReturnValue(true);

    const { validateTwilioRequest } = await import("@/app/api/webhooks/twilio/validate");

    const req = createMockReq({ "x-twilio-signature": "unicode_sig" });
    const result = validateTwilioRequest(req, {
      CallSid: "CA123",
      message: "Bonjour ça va? 你好",
    });

    expect(result).toBe(true);
  });
});

describe("extractParams — FormData extraction", () => {
  it("should extract all string fields from FormData", async () => {
    const { extractParams } = await import("@/app/api/webhooks/twilio/validate");

    const formData = new Map<string, FormDataEntryValue>([
      ["CallSid", "CA_test123"],
      ["CallStatus", "completed"],
      ["CallDuration", "120"],
    ]) as unknown as FormData;

    const params = extractParams(formData);

    expect(params).toEqual({
      CallSid: "CA_test123",
      CallStatus: "completed",
      CallDuration: "120",
    });
  });

  it("should skip non-string entries (e.g. File/Blob)", async () => {
    const { extractParams } = await import("@/app/api/webhooks/twilio/validate");

    const formData = new Map<string, FormDataEntryValue>([
      ["CallSid", "CA_test"],
      ["audio", new File(["audio data"], "audio.wav")],
    ]) as unknown as FormData;

    const params = extractParams(formData);

    expect(params).toEqual({ CallSid: "CA_test" });
  });

  it("should return empty object for empty FormData", async () => {
    const { extractParams } = await import("@/app/api/webhooks/twilio/validate");

    const formData = new Map() as unknown as FormData;
    const params = extractParams(formData);

    expect(params).toEqual({});
  });
});
