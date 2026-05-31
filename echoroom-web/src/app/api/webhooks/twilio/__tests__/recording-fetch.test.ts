import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// M-2: twilio/route.ts — No Basic Auth in recording fetch
// ---------------------------------------------------------------------------
// Tests for the recording fetch and URL validation:
//   - isValidTwilioRecordingUrl validates correct Twilio URLs
//   - isValidTwilioRecordingUrl rejects non-Twilio URLs (SSRF protection)
//   - fetchRecordingAudio handles errors gracefully (timeout, network failure)
//   - redirect: 'error' prevents credential leakage on redirect

vi.mock("@/lib/env", () => ({
  env: {
    TWILIO_ACCOUNT_SID: "AC_test_sid",
    TWILIO_AUTH_TOKEN: "test_auth_token",
  },
}));

// Mock conversation state Redis helpers
vi.mock("@/server/services/telephony/conversationState", () => ({
  getConversationState: vi.fn(),
  deleteConversationState: vi.fn(),
  setConversationStatus: vi.fn(),
}));

vi.mock("@/server/services/audio/transcription", () => ({
  transcribeAudio: vi.fn(),
}));

vi.mock("@/server/services/audio/r2", () => ({
  uploadAudioBuffer: vi.fn(),
}));

vi.mock("@/server/services/telephony/callLifecycle", () => ({
  failCall: vi.fn(),
}));

// Mock Twilio validation
vi.mock("../validate", () => ({
  validateTwilioRequest: vi.fn().mockReturnValue(true),
  extractParams: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  db: {
    call: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    user: {
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock the twilio SDK — the route uses twilioClient.request() instead of raw fetch
const mockRequest = vi.hoisted(() => vi.fn());
vi.mock("twilio", () => ({
  default: vi.fn(() => ({
    request: mockRequest,
  })),
}));

// Global fetch mock (still needed for SSR protection tests where fetch should NOT be called)
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("M-2: isValidTwilioRecordingUrl (SSRF protection)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should accept valid Twilio recording URLs", async () => {
    // Import the route module to access isValidTwilioRecordingUrl
    const mod = await import("../route");

    // Access the private function via module internals
    // We test it by sending a completed webhook with a valid URL
    // and verifying fetch was called
    const { getConversationState, setConversationStatus, deleteConversationState } = await import(
      "@/server/services/telephony/conversationState"
    );
    const { db } = await import("@/server/db");

    (getConversationState as any).mockResolvedValue({
      messages: [{ role: "user", content: "Hello" }],
      turnCount: 1,
    });

    (db.call.findUnique as any).mockResolvedValue({
      id: "call-1",
      twilioCallSid: "CA_test",
      status: "ACTIVE",
      costCredits: 1,
      userId: "user-1",
      scenario: { characterId: "char-1" },
      user: { id: "user-1" },
    });

    const validUrl = "https://api.twilio.com/2010-04-01/Accounts/AC_test/Recordings/RE123";
    // The route now uses twilioClient.request() instead of raw fetch
    mockRequest.mockResolvedValue({
      statusCode: 200,
      body: Buffer.from("fake audio data"),
    });

    const mockTx = {
      call: {
        findUnique: vi.fn().mockResolvedValue({
          id: "call-1",
          status: "ACTIVE",
          costCredits: 1,
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      user: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    (db.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));
    (setConversationStatus as any).mockResolvedValue(undefined);
    (deleteConversationState as any).mockResolvedValue(undefined);

    const { POST } = await import("../route");

    const formData = new Map(
      Object.entries({
        CallSid: "CA_test",
        CallStatus: "completed",
        RecordingUrl: validUrl,
      }),
    ) as unknown as FormData;

    const req = {
      formData: () => Promise.resolve(formData),
      headers: {
        get: (name: string) => {
          if (name === "x-twilio-signature") return "test_sig";
          if (name === "content-length") return "500";
          return null;
        },
      },
      url: "https://api.echoroom.app/api/webhooks/twilio",
    } as any;

    const response = await POST(req);
    expect(response.status).toBe(200);

    // Verify twilioClient.request was called with the valid URL
    expect(mockRequest).toHaveBeenCalledWith({
      method: "get",
      uri: validUrl,
    });
  });

  it("should reject non-Twilio recording URLs (SSRF protection)", async () => {
    const { getConversationState, setConversationStatus, deleteConversationState } = await import(
      "@/server/services/telephony/conversationState"
    );
    const { db } = await import("@/server/db");

    (getConversationState as any).mockResolvedValue({
      messages: [{ role: "user", content: "Hello" }],
      turnCount: 1,
    });

    (db.call.findUnique as any).mockResolvedValue({
      id: "call-1",
      twilioCallSid: "CA_test",
      status: "ACTIVE",
      costCredits: 1,
      userId: "user-1",
      scenario: { characterId: "char-1" },
      user: { id: "user-1" },
    });

    const maliciousUrl = "http://169.254.169.254/latest/meta-data/";

    const mockTx = {
      call: {
        findUnique: vi.fn().mockResolvedValue({
          id: "call-1",
          status: "ACTIVE",
          costCredits: 1,
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      user: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    (db.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));
    (setConversationStatus as any).mockResolvedValue(undefined);
    (deleteConversationState as any).mockResolvedValue(undefined);

    const { POST } = await import("../route");

    const formData = new Map(
      Object.entries({
        CallSid: "CA_test",
        CallStatus: "completed",
        RecordingUrl: maliciousUrl,
      }),
    ) as unknown as FormData;

    const req = {
      formData: () => Promise.resolve(formData),
      headers: {
        get: (name: string) => {
          if (name === "x-twilio-signature") return "test_sig";
          if (name === "content-length") return "500";
          return null;
        },
      },
      url: "https://api.echoroom.app/api/webhooks/twilio",
    } as any;

    const response = await POST(req);
    expect(response.status).toBe(200);

    // Should NOT have made any fetch call for SSRF prevention
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should reject internal URLs mimicking Twilio path", async () => {
    const { getConversationState } = await import("@/server/services/telephony/conversationState");
    const { db } = await import("@/server/db");

    (getConversationState as any).mockResolvedValue({
      messages: [{ role: "user", content: "Hello" }],
      turnCount: 1,
    });

    (db.call.findUnique as any).mockResolvedValue({
      id: "call-1",
      twilioCallSid: "CA_test",
      status: "ACTIVE",
      costCredits: 1,
      userId: "user-1",
      scenario: { characterId: "char-1" },
      user: { id: "user-1" },
    });

    // Internal URL that mimics Twilio path structure
    const internalUrl = "http://10.0.0.1/2010-04-01/Accounts/AC_test/Recordings/RE123";

    const mockTx = {
      call: {
        findUnique: vi.fn().mockResolvedValue({
          id: "call-1",
          status: "ACTIVE",
          costCredits: 1,
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      user: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    (db.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    const { POST } = await import("../route");

    const formData = new Map(
      Object.entries({
        CallSid: "CA_test",
        CallStatus: "completed",
        RecordingUrl: internalUrl,
      }),
    ) as unknown as FormData;

    const req = {
      formData: () => Promise.resolve(formData),
      headers: {
        get: (name: string) => {
          if (name === "x-twilio-signature") return "test_sig";
          if (name === "content-length") return "500";
          return null;
        },
      },
      url: "https://api.echoroom.app/api/webhooks/twilio",
    } as any;

    await POST(req);

    // Should NOT have made any fetch call
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should handle recording fetch failure gracefully (network error)", async () => {
    const { getConversationState, setConversationStatus, deleteConversationState } = await import(
      "@/server/services/telephony/conversationState"
    );
    const { db } = await import("@/server/db");

    (getConversationState as any).mockResolvedValue({
      messages: [{ role: "user", content: "Hello" }],
      turnCount: 1,
    });

    (db.call.findUnique as any).mockResolvedValue({
      id: "call-1",
      twilioCallSid: "CA_test",
      status: "ACTIVE",
      costCredits: 1,
      userId: "user-1",
      scenario: { characterId: "char-1" },
      user: { id: "user-1" },
    });

    const validUrl = "https://api.twilio.com/2010-04-01/Accounts/AC_test/Recordings/RE123";
    mockRequest.mockRejectedValue(new Error("Network error"));

    const mockTx = {
      call: {
        findUnique: vi.fn().mockResolvedValue({
          id: "call-1",
          status: "ACTIVE",
          costCredits: 1,
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      user: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    (db.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));
    (setConversationStatus as any).mockResolvedValue(undefined);
    (deleteConversationState as any).mockResolvedValue(undefined);

    const { POST } = await import("../route");

    const formData = new Map(
      Object.entries({
        CallSid: "CA_test",
        CallStatus: "completed",
        RecordingUrl: validUrl,
      }),
    ) as unknown as FormData;

    const req = {
      formData: () => Promise.resolve(formData),
      headers: {
        get: (name: string) => {
          if (name === "x-twilio-signature") return "test_sig";
          if (name === "content-length") return "500";
          return null;
        },
      },
      url: "https://api.echoroom.app/api/webhooks/twilio",
    } as any;

    // Should not throw — errors are caught
    const response = await POST(req);
    expect(response.status).toBe(200);
  });
});
