import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// wrapTwilioWebhook tests
// ---------------------------------------------------------------------------
// Tests for twilioWebhook.ts wrapTwilioWebhook:
//   - Missing Twilio signature → 403
//   - Body > 50KB → 413
//   - Body exactly 50KB → passes through (no 413)
//   - Rate limit exceeded → 429
//   - Rate limit check failure → continues (graceful degradation)
//   - IP extraction: x-forwarded-for, x-real-ip, unknown
//   - Twilio params extraction (CallSid, CallStatus, etc.)
//   - Invalid Twilio signature → 403

// Store shared mock references for assertions
const mockNextResponseJson = vi.fn((body: unknown, init?: ResponseInit) => ({
  body,
  status: (init as { status?: number })?.status ?? 200,
  headers: (init as { headers?: Record<string, string> })?.headers ?? {},
}));

vi.mock("next/server", () => ({
  NextRequest: vi.fn(),
  NextResponse: {
    json: mockNextResponseJson,
  },
}));

const mockValidateRequest = vi.fn();
vi.mock("twilio", () => ({
  default: {
    validateRequest: mockValidateRequest,
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    TWILIO_AUTH_TOKEN: "test_twilio_auth_token",
  },
}));

const mockCheckWebhookRateLimit = vi.fn();
vi.mock("@/app/api/webhooks/rateLimit", () => ({
  checkWebhookRateLimit: mockCheckWebhookRateLimit,
}));

const mockLogInstance = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => mockLogInstance),
}));

function createMockRequest({
  url = "https://echoroom.app/api/webhooks/twilio",
  method = "POST",
  headers = {},
  body = "",
  formData = new Map(),
}: {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  formData?: Map<string, string>;
} = {}) {
  return {
    url,
    method,
    headers: {
      get: vi.fn((key: string) => headers[key] ?? null),
      forEach: vi.fn(),
    },
    formData: vi.fn().mockResolvedValue({
      entries: vi.fn(() => formData.entries()),
      get: vi.fn((key: string) => formData.get(key) ?? null),
      forEach: vi.fn(),
    }),
    text: vi.fn().mockResolvedValue(body),
  } as unknown as Request;
}

describe("wrapTwilioWebhook", () => {
  let wrapTwilioWebhook: typeof import("../twilioWebhook").wrapTwilioWebhook;
  let handler: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-import to get fresh handler reference
    const mod = await import("../twilioWebhook");
    wrapTwilioWebhook = mod.wrapTwilioWebhook;
    handler = vi.fn().mockResolvedValue({ body: "ok", status: 200 });
  });

  // -----------------------------------------------------------------------
  // Signature missing
  // -----------------------------------------------------------------------

  it("should return 403 when Twilio signature header is missing", async () => {
    mockCheckWebhookRateLimit.mockResolvedValue(true);

    const wrapped = wrapTwilioWebhook("twilio:status", handler);

    const req = createMockRequest({
      headers: { "content-length": "100" },
    });
    await wrapped(req as any);

    expect(mockNextResponseJson).toHaveBeenCalledWith(
      { error: "Signature manquante" },
      { status: 403 },
    );
    expect(handler).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Body size enforcement
  // -----------------------------------------------------------------------

  it("should return 413 when body exceeds 50KB", async () => {
    const wrapped = wrapTwilioWebhook("twilio:status", handler);

    const req = createMockRequest({
      headers: { "content-length": "50001" },
    });
    await wrapped(req as any);

    expect(mockNextResponseJson).toHaveBeenCalledWith(
      { error: "Requête trop volumineuse" },
      { status: 413 },
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it("should NOT reject body of exactly 50KB", async () => {
    mockValidateRequest.mockReturnValue(true);
    mockCheckWebhookRateLimit.mockResolvedValue(true);

    const wrapped = wrapTwilioWebhook("twilio:status", handler);

    const req = createMockRequest({
      headers: {
        "content-length": "50000",
        "x-twilio-signature": "valid-signature",
      },
      formData: new Map([["CallSid", "CA123"]]),
    });
    await wrapped(req as any);

    expect(mockNextResponseJson).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 413 }),
    );
    // Should proceed to signature validation
    expect(mockValidateRequest).toHaveBeenCalled();
  });

  it("should NOT reject body under 50KB", async () => {
    mockValidateRequest.mockReturnValue(true);
    mockCheckWebhookRateLimit.mockResolvedValue(true);

    const wrapped = wrapTwilioWebhook("twilio:status", handler);

    const req = createMockRequest({
      headers: {
        "content-length": "100",
        "x-twilio-signature": "valid-signature",
      },
      formData: new Map([["CallSid", "CA123"]]),
    });
    await wrapped(req as any);

    expect(mockNextResponseJson).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 413 }),
    );
  });

  // -----------------------------------------------------------------------
  // Rate limiting
  // -----------------------------------------------------------------------

  it("should return 429 when rate limit is exceeded", async () => {
    mockCheckWebhookRateLimit.mockResolvedValue(false);

    const wrapped = wrapTwilioWebhook("twilio:status", handler);

    const req = createMockRequest({
      headers: {
        "content-length": "100",
        "x-twilio-signature": "sig",
      },
    });
    await wrapped(req as any);

    expect(mockNextResponseJson).toHaveBeenCalledWith(
      { error: "Trop de requêtes" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it("should continue when rate limit check throws (graceful degradation)", async () => {
    mockCheckWebhookRateLimit.mockRejectedValue(new Error("Redis down"));
    mockValidateRequest.mockReturnValue(true);

    const wrapped = wrapTwilioWebhook("twilio:status", handler);

    const req = createMockRequest({
      headers: {
        "content-length": "100",
        "x-twilio-signature": "valid-sig",
      },
      formData: new Map([["CallSid", "CA123"]]),
    });
    await wrapped(req as any);

    // Should log warning and continue to signature validation
    expect(mockLogInstance.warn).toHaveBeenCalledWith(
      "Webhook rate limit check failed - allowing request through",
      expect.objectContaining({ error: expect.any(Error) }),
    );
    expect(mockValidateRequest).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // IP extraction
  // -----------------------------------------------------------------------

  it("should extract IP from x-forwarded-for header", async () => {
    mockValidateRequest.mockReturnValue(true);
    mockCheckWebhookRateLimit.mockResolvedValue(true);

    const wrapped = wrapTwilioWebhook("twilio:voice:init", handler);

    const req = createMockRequest({
      headers: {
        "content-length": "100",
        "x-forwarded-for": "203.0.113.42, 10.0.0.1",
        "x-twilio-signature": "sig",
      },
      formData: new Map([["CallSid", "CA123"]]),
    });
    await wrapped(req as any);

    expect(mockCheckWebhookRateLimit).toHaveBeenCalledWith(
      "twilio:voice:init",
      "203.0.113.42",
    );
  });

  it("should fall back to x-real-ip when x-forwarded-for is absent", async () => {
    mockValidateRequest.mockReturnValue(true);
    mockCheckWebhookRateLimit.mockResolvedValue(true);

    const wrapped = wrapTwilioWebhook("twilio:voice:init", handler);

    const req = createMockRequest({
      headers: {
        "content-length": "100",
        "x-real-ip": "198.51.100.7",
        "x-twilio-signature": "sig",
      },
      formData: new Map([["CallSid", "CA123"]]),
    });
    await wrapped(req as any);

    expect(mockCheckWebhookRateLimit).toHaveBeenCalledWith(
      "twilio:voice:init",
      "198.51.100.7",
    );
  });

  it("should use 'unknown' when neither IP header is present", async () => {
    mockValidateRequest.mockReturnValue(true);
    mockCheckWebhookRateLimit.mockResolvedValue(true);

    const wrapped = wrapTwilioWebhook("twilio:voice:init", handler);

    const req = createMockRequest({
      headers: {
        "content-length": "100",
        "x-twilio-signature": "sig",
      },
      formData: new Map([["CallSid", "CA123"]]),
    });
    await wrapped(req as any);

    expect(mockCheckWebhookRateLimit).toHaveBeenCalledWith(
      "twilio:voice:init",
      "unknown",
    );
  });

  // -----------------------------------------------------------------------
  // Twilio signature validation
  // -----------------------------------------------------------------------

  it("should return 403 when Twilio signature is invalid", async () => {
    mockCheckWebhookRateLimit.mockResolvedValue(true);
    mockValidateRequest.mockReturnValue(false);

    const wrapped = wrapTwilioWebhook("twilio:status", handler);

    const req = createMockRequest({
      headers: {
        "content-length": "100",
        "x-twilio-signature": "invalid-sig",
      },
      formData: new Map([["CallSid", "CA123"]]),
    });
    await wrapped(req as any);

    expect(mockNextResponseJson).toHaveBeenCalledWith(
      { error: "Signature invalide" },
      { status: 403 },
    );
    expect(handler).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Twilio params extraction
  // -----------------------------------------------------------------------

  it("should extract Twilio webhook params and pass them to handler", async () => {
    mockCheckWebhookRateLimit.mockResolvedValue(true);
    mockValidateRequest.mockReturnValue(true);

    const wrapped = wrapTwilioWebhook("twilio:status", handler);

    const formData = new Map<string, string>([
      ["CallSid", "CA123456789"],
      ["CallStatus", "completed"],
      ["CallDuration", "120"],
      ["RecordingUrl", "https://api.twilio.com/recordings/RE123"],
      ["RecordingDuration", "115"],
      ["From", "+33612345678"],
      ["SpeechResult", "Hello world"],
      ["extraParam", "extraValue"],
    ]);

    const req = createMockRequest({
      headers: {
        "content-length": "100",
        "x-twilio-signature": "valid-sig",
      },
      formData,
    });
    await wrapped(req as any);

    expect(handler).toHaveBeenCalledWith(
      req,
      expect.objectContaining({
        callSid: "CA123456789",
        callStatus: "completed",
        callDuration: "120",
        recordingUrl: "https://api.twilio.com/recordings/RE123",
        recordingDuration: "115",
        fromNumber: "+33612345678",
        speechResult: "Hello world",
      }),
    );
  });

  it("should include raw params in the webhook params", async () => {
    mockCheckWebhookRateLimit.mockResolvedValue(true);
    mockValidateRequest.mockReturnValue(true);

    const wrapped = wrapTwilioWebhook("twilio:status", handler);

    const formData = new Map<string, string>([
      ["CallSid", "CA123"],
      ["customField", "customValue"],
    ]);

    const req = createMockRequest({
      headers: {
        "content-length": "100",
        "x-twilio-signature": "valid-sig",
      },
      formData,
    });
    await wrapped(req as any);

    expect(handler).toHaveBeenCalledWith(
      req,
      expect.objectContaining({
        raw: expect.objectContaining({
          CallSid: "CA123",
          customField: "customValue",
        }),
      }),
    );
  });

  it("should pass the handler's response through", async () => {
    mockCheckWebhookRateLimit.mockResolvedValue(true);
    mockValidateRequest.mockReturnValue(true);

    const expectedResponse = { body: "processed", status: 200 };
    handler.mockResolvedValue(expectedResponse);

    const wrapped = wrapTwilioWebhook("twilio:status", handler);

    const formData = new Map<string, string>([["CallSid", "CA123"]]);
    const req = createMockRequest({
      headers: {
        "content-length": "100",
        "x-twilio-signature": "valid-sig",
      },
      formData,
    });

    const result = await wrapped(req as any);
    expect(result).toBe(expectedResponse);
  });
});
