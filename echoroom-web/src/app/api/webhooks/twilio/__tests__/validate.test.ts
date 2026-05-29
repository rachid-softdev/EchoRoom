import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

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
  default: Object.assign(
    vi.fn(),
    { validateRequest: mockValidateRequest },
  ),
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

  it("should accept optional url override", async () => {
    mockValidateRequest.mockReturnValue(true);

    const { validateTwilioRequest } = await import("../validate");

    const req = createMockReq({
      "x-twilio-signature": "sig",
    });
    const result = validateTwilioRequest(
      req,
      { CallSid: "CA_test" },
      "https://custom.url/webhook",
    );

    expect(result).toBe(true);
    // Should use the provided URL instead of req.url
    expect(mockValidateRequest).toHaveBeenCalledWith(
      "test_auth_token",
      "sig",
      "https://custom.url/webhook",
      { CallSid: "CA_test" },
    );
  });
});
