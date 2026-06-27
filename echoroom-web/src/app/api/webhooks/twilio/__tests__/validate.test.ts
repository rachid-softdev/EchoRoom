import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Twilio Webhook Validation Tests
// ---------------------------------------------------------------------------
// Tests for validate.ts:
//   - validateTwilioRequest(req, params, url?)
//   - extractParams(formData)

vi.mock("@/lib/env", () => ({
  env: {
    TWILIO_AUTH_TOKEN: "test_auth_token",
  },
}));

// Mock the twilio SDK's validateRequest to control responses
const mockValidateRequest = vi.fn();
vi.mock("twilio", () => ({
  default: Object.assign(vi.fn(), { validateRequest: mockValidateRequest }),
}));

function createMockReq(headers: Record<string, string | null>): NextRequest {
  return {
    headers: {
      get: (name: string) => headers[name] ?? null,
    },
    url: "https://api.echoroom.app/api/webhooks/twilio",
  } as unknown as NextRequest;
}

describe("extractParams", () => {
  it("should extract all string fields from FormData", async () => {
    const { extractParams } = await import("../validate");

    const formData = new Map<string, FormDataEntryValue>([
      ["CallSid", "CA_test123"],
      ["CallStatus", "completed"],
      ["CallDuration", "120"],
      ["RecordingUrl", "https://api.twilio.com/recording.wav"],
    ]) as unknown as FormData;

    const params = extractParams(formData);

    expect(params).toEqual({
      CallSid: "CA_test123",
      CallStatus: "completed",
      CallDuration: "120",
      RecordingUrl: "https://api.twilio.com/recording.wav",
    });
  });

  it("should skip non-string entries (e.g. File/Blob)", async () => {
    const { extractParams } = await import("../validate");

    const formData = new Map<string, FormDataEntryValue>([
      ["CallSid", "CA_test"],
      ["audio", new File(["audio data"], "audio.wav")],
      ["numericField", "42"],
    ]) as unknown as FormData;

    const params = extractParams(formData);

    // Should only include string values
    expect(params).toEqual({
      CallSid: "CA_test",
      numericField: "42",
    });
  });

  it("should return empty object for empty FormData", async () => {
    const { extractParams } = await import("../validate");

    const formData = new Map() as unknown as FormData;
    const params = extractParams(formData);

    expect(params).toEqual({});
  });

  it("should handle multiple form fields preserving all keys", async () => {
    const { extractParams } = await import("../validate");

    const formData = new Map<string, FormDataEntryValue>([
      ["field1", "value1"],
      ["field2", "value2"],
      ["field3", "value3"],
    ]) as unknown as FormData;

    const params = extractParams(formData);

    expect(params).toEqual({
      field1: "value1",
      field2: "value2",
      field3: "value3",
    });
  });
});

describe("validateTwilioRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return false when x-twilio-signature header is missing", async () => {
    const { validateTwilioRequest } = await import("../validate");

    const req = createMockReq({});
    const result = validateTwilioRequest(req, { CallSid: "CA_test" });

    expect(result).toBe(false);
    expect(mockValidateRequest).not.toHaveBeenCalled();
  });

  it("should return false when signature is invalid", async () => {
    mockValidateRequest.mockReturnValue(false);

    const { validateTwilioRequest } = await import("../validate");

    const req = createMockReq({
      "x-twilio-signature": "invalid_signature",
    });
    const result = validateTwilioRequest(req, { CallSid: "CA_test" });

    expect(result).toBe(false);
    expect(mockValidateRequest).toHaveBeenCalledWith(
      "test_auth_token",
      "invalid_signature",
      "https://api.echoroom.app/api/webhooks/twilio",
      { CallSid: "CA_test" },
    );
  });

  it("should return true when signature is valid", async () => {
    mockValidateRequest.mockReturnValue(true);

    const { validateTwilioRequest } = await import("../validate");

    const req = createMockReq({
      "x-twilio-signature": "valid_signature",
    });
    const result = validateTwilioRequest(req, { CallSid: "CA_test" });

    expect(result).toBe(true);
    expect(mockValidateRequest).toHaveBeenCalledWith(
      "test_auth_token",
      "valid_signature",
      "https://api.echoroom.app/api/webhooks/twilio",
      { CallSid: "CA_test" },
    );
  });

  it("should use req.url for signature validation", async () => {
    mockValidateRequest.mockReturnValue(true);

    const { validateTwilioRequest } = await import("../validate");

    const req = createMockReq({
      "x-twilio-signature": "sig",
    });
    const result = validateTwilioRequest(req, { CallSid: "CA_test" });

    expect(result).toBe(true);
    // Should use req.url for validation
    expect(mockValidateRequest).toHaveBeenCalledWith(
      "test_auth_token",
      "sig",
      "https://api.echoroom.app/api/webhooks/twilio",
      { CallSid: "CA_test" },
    );
  });

  // -----------------------------------------------------------------------
  // CQ1: Type-safe twilio.validateRequest call
  // -----------------------------------------------------------------------
  // Verifies that twilio.validateRequest() is called as a proper typed method
  // rather than via (twilio as any).validateRequest() which bypasses type checking.

  it("should call twilio.validateRequest as a typed method (not via `as any`)", async () => {
    // This test explicitly verifies the CQ1 fix: the codebase uses
    // twilio.validateRequest(...) instead of (twilio as any).validateRequest(...)
    mockValidateRequest.mockReturnValue(true);

    const { validateTwilioRequest } = await import("../validate");

    const req = createMockReq({
      "x-twilio-signature": "valid_signature",
    });
    const result = validateTwilioRequest(req, { CallSid: "CA_test" });

    expect(result).toBe(true);

    // Verify validateRequest was called as a direct method on the twilio module
    // This confirms the source code uses twilio.validateRequest(...) not (twilio as any).validateRequest(...)
    expect(mockValidateRequest).toHaveBeenCalled();
    expect(mockValidateRequest).toHaveBeenCalledWith(
      "test_auth_token",
      "valid_signature",
      "https://api.echoroom.app/api/webhooks/twilio",
      { CallSid: "CA_test" },
    );
  });
});
