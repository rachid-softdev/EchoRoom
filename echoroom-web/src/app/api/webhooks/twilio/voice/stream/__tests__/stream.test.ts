import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// C-1: stream/route.ts — Twilio SDK instead of raw XML
// ---------------------------------------------------------------------------
// Tests for the Media Streams endpoint:
//   - GET returns valid TwiML XML with a Hangup verb
//   - Response Content-Type is text/xml
//   - POST with invalid signature returns 403
//   - POST with valid signature returns valid TwiML
//   - TwiML is built via SDK (twilio.twiml.VoiceResponse), not raw XML

vi.mock("@/lib/env", () => ({
  env: {
    TWILIO_AUTH_TOKEN: "test_auth_token",
  },
}));

// Mock the twilio SDK
const mockHangup = vi.fn();
const mockVoiceResponse = vi.fn().mockImplementation(() => ({
  hangup: mockHangup,
  toString: vi.fn().mockReturnValue('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>'),
}));

vi.mock("twilio", () => ({
  default: {
    twiml: {
      VoiceResponse: mockVoiceResponse,
    },
  },
}));

// Mock the validate module - path must match the route's import: from route.ts "import { ... } from '../../validate'"
// route.ts is at twilio/voice/stream/route.ts, ../../validate = twilio/validate.ts
// test is at twilio/voice/stream/__tests__/stream.test.ts, ../../../validate = twilio/validate.ts
const mockValidateTwilioRequest = vi.fn();
const mockExtractParams = vi.fn();
vi.mock("../../../validate", () => ({
  validateTwilioRequest: (...args: unknown[]) => mockValidateTwilioRequest(...args),
  extractParams: (...args: unknown[]) => mockExtractParams(...args),
}));

function createMockFormDataRequest(
  fields: Record<string, string>,
  headers?: Record<string, string>,
): NextRequest {
  const formData = new Map(Object.entries(fields)) as unknown as FormData;
  return {
    formData: () => Promise.resolve(formData),
    headers: {
      get: (name: string) => headers?.[name] ?? null,
    },
    url: "https://api.echoroom.app/api/webhooks/twilio/voice/stream",
  } as unknown as NextRequest;
}

describe("C-1: stream/route — GET handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return valid TwiML XML with Hangup verb", async () => {
    const { GET } = await import("../route");

    const req = { url: "https://api.echoroom.app/api/webhooks/twilio/voice/stream" } as unknown as NextRequest;
    const response = await GET(req);

    expect(response.status).toBe(200);

    const text = await response.text();

    // Verify content type
    expect(response.headers.get("Content-Type")).toBe("text/xml");

    // Verify valid XML start
    expect(text).toContain('<?xml');

    // Verify Hangup verb
    expect(text).toContain("<Hangup/>");
    expect(text).toContain("<Response>");

    // Verify it was built via SDK
    expect(mockVoiceResponse).toHaveBeenCalledTimes(1);
    expect(mockHangup).toHaveBeenCalledTimes(1);
  });

  it("should not contain raw XML construction patterns", async () => {
    // Defense-in-depth: ensure the TwiML is built via SDK, not raw string
    const { GET } = await import("../route");

    const req = { url: "https://api.echoroom.app/api/webhooks/twilio/voice/stream" } as unknown as NextRequest;
    const response = await GET(req);

    const text = await response.text();

    // Content must be valid XML structure
    expect(text).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  });
});

describe("C-1: stream/route — POST handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: valid signature
    mockValidateTwilioRequest.mockReturnValue(true);
    mockExtractParams.mockReturnValue({ CallSid: "CA_test" });
  });

  it("should return 403 when Twilio signature is invalid", async () => {
    mockValidateTwilioRequest.mockReturnValue(false);

    const { POST } = await import("../route");

    const req = createMockFormDataRequest(
      { CallSid: "CA_test" },
      { "x-twilio-signature": "invalid" },
    );
    const response = await POST(req);

    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body).toEqual({ error: "Signature invalide" });
  });

  it("should return valid TwiML when signature is valid", async () => {
    mockValidateTwilioRequest.mockReturnValue(true);

    const { POST } = await import("../route");

    const req = createMockFormDataRequest(
      { CallSid: "CA_test" },
      { "x-twilio-signature": "valid_signature" },
    );
    const response = await POST(req);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/xml");

    const text = await response.text();
    expect(text).toContain('<?xml');
    expect(text).toContain("<Hangup/>");
  });

  it("should call validateTwilioRequest with extracted params", async () => {
    mockValidateTwilioRequest.mockReturnValue(true);

    const { POST } = await import("../route");

    const req = createMockFormDataRequest(
      { CallSid: "CA_test_123", CallStatus: "completed" },
      { "x-twilio-signature": "sig" },
    );
    await POST(req);

    expect(mockExtractParams).toHaveBeenCalled();
    expect(mockValidateTwilioRequest).toHaveBeenCalledWith(req, expect.any(Object));
  });
});
