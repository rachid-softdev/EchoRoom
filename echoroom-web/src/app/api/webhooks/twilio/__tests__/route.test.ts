import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Twilio Status Webhook Route tests
// ---------------------------------------------------------------------------
// POST /api/webhooks/twilio:
//   Handles Twilio call status callbacks.
//   - Completed: processes recording, transcript, credit reconciliation
//   - Busy/no-answer/failed/canceled: marks call as failed
//   - Ringing/in-progress: updates status
//
// Idempotency: checks callRecord.status === "COMPLETED" before processing,
// and double-checks inside the $transaction.

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

// Mock Twilio validation to always pass in route tests
// (validateTwilioRequest is tested separately in validate.test.ts)
vi.mock("../validate", () => ({
  validateTwilioRequest: vi.fn().mockReturnValue(true),
  extractParams: vi.fn((formData) => {
    const params: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") params[key] = value;
    }
    return params;
  }),
}));

// Mock the twilio SDK — the route uses twilioClient.request() instead of raw fetch
const mockTwilioRequest = vi.hoisted(() => vi.fn());
vi.mock("twilio", () => ({
  default: vi.fn(() => ({
    request: mockTwilioRequest,
  })),
}));

// Fetch is globally available in Node 18+ / jsdom
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockHeaders = {
  get: vi.fn((name: string) => {
    if (name === "x-twilio-signature") return "test_signature";
    return null;
  }),
};

function createFormDataRequest(fields: Record<string, string>): NextRequest {
  const formData = new Map(Object.entries(fields));
  mockHeaders.get.mockImplementation((name: string) => {
    if (name === "x-twilio-signature") return "test_signature";
    return null;
  });
  return {
    formData: () => Promise.resolve(formData),
    headers: mockHeaders,
  } as unknown as NextRequest;
}

describe("Twilio webhook POST handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Missing CallSid
  // -----------------------------------------------------------------------

  it("should return ok when CallSid is missing", async () => {
    const { POST } = await import("../route");

    const req = createFormDataRequest({});
    const response = await POST(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: "ok" });
  });

  // -----------------------------------------------------------------------
  // Call status: completed — idempotency
  // -----------------------------------------------------------------------

  it("should skip duplicate completed webhooks (already COMPLETED)", async () => {
    const { getConversationState } = await import("@/server/services/telephony/conversationState");
    const { db } = await import("@/server/db");

    // Mock conversation state
    (getConversationState as any).mockResolvedValue({
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ],
      turnCount: 2,
    });

    // Mock call record — already completed
    (db.call.findUnique as any).mockResolvedValue({
      id: "call-1",
      twilioCallSid: "CA_test",
      status: "COMPLETED",
      costCredits: 2,
      userId: "user-1",
      scenario: { characterId: "char-1" },
      user: { id: "user-1" },
    });

    const { POST } = await import("../route");

    const req = createFormDataRequest({
      CallSid: "CA_test",
      CallStatus: "completed",
      CallDuration: "120",
      RecordingUrl: "https://api.twilio.com/2010-04-01/Accounts/AC_test/Recordings/RE_test",
      RecordingDuration: "115",
    });

    const response = await POST(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: "ok" });

    // Should NOT proceed with transaction since already completed
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("should process new completed call with recording", async () => {
    const { getConversationState, setConversationStatus, deleteConversationState } = await import(
      "@/server/services/telephony/conversationState"
    );
    const { transcribeAudio } = await import("@/server/services/audio/transcription");
    const { uploadAudioBuffer } = await import("@/server/services/audio/r2");
    const { db } = await import("@/server/db");

    // Mock conversation state
    (getConversationState as any).mockResolvedValue({
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ],
      turnCount: 2,
    });

    // Mock call record — not completed yet
    (db.call.findUnique as any).mockResolvedValue({
      id: "call-1",
      twilioCallSid: "CA_test",
      status: "ACTIVE",
      costCredits: 1,
      userId: "user-1",
      scenario: { characterId: "char-1" },
      user: { id: "user-1" },
    });

    // Mock Twilio SDK request for recording fetch
    mockTwilioRequest.mockResolvedValue({
      statusCode: 200,
      body: Buffer.from("fake audio data"),
    });

    // Mock transcription
    (transcribeAudio as any).mockResolvedValue({
      transcript: "Hello, hi there!",
    });

    // Mock R2 upload
    (uploadAudioBuffer as any).mockResolvedValue("r2-key-123");

    // Mock $transaction callback — it receives (tx) => Promise<void>
    // We'll have it call the callback with a mock tx
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

    // The $transaction receives a callback function
    (db.$transaction as any).mockImplementation(async (cbOrArray: any) => {
      if (typeof cbOrArray === "function") {
        return cbOrArray(mockTx);
      }
      return cbOrArray;
    });

    (setConversationStatus as any).mockResolvedValue(undefined);
    (deleteConversationState as any).mockResolvedValue(undefined);

    const { POST } = await import("../route");

    const req = createFormDataRequest({
      CallSid: "CA_test",
      CallStatus: "completed",
      CallDuration: "120",
      RecordingUrl: "https://api.twilio.com/2010-04-01/Accounts/AC_test/Recordings/RE123",
      RecordingDuration: "115",
    });

    const response = await POST(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: "ok" });

    // Verify transaction executed
    expect(db.$transaction).toHaveBeenCalled();

    // Verify the double-check inside transaction
    expect(mockTx.call.findUnique).toHaveBeenCalledWith({
      where: { id: "call-1" },
      select: { status: true, costCredits: true },
    });

    // Verify call was updated in transaction
    expect(mockTx.call.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "call-1" },
        data: expect.objectContaining({
          status: "COMPLETED",
          durationSeconds: 120,
        }),
      }),
    );

    // Verify cleanup
    expect(setConversationStatus).toHaveBeenCalledWith("CA_test", "completed");
    expect(deleteConversationState).toHaveBeenCalledWith("CA_test");
  });

  it("should handle completed call without recording (RecordingUrl null)", async () => {
    const { db } = await import("@/server/db");
    const { getConversationState, setConversationStatus, deleteConversationState } = await import(
      "@/server/services/telephony/conversationState"
    );

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

    const req = createFormDataRequest({
      CallSid: "CA_test",
      CallStatus: "completed",
      CallDuration: "60",
      // No RecordingUrl
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    // Verify recording was not fetched
    expect(mockTwilioRequest).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should handle no call record found for completed call", async () => {
    const { db } = await import("@/server/db");
    const { getConversationState, setConversationStatus, deleteConversationState } = await import(
      "@/server/services/telephony/conversationState"
    );

    (getConversationState as any).mockResolvedValue(null);
    (db.call.findUnique as any).mockResolvedValue(null);
    (setConversationStatus as any).mockResolvedValue(undefined);
    (deleteConversationState as any).mockResolvedValue(undefined);

    const { POST } = await import("../route");

    const req = createFormDataRequest({
      CallSid: "CA_test_none",
      CallStatus: "completed",
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    // Should not attempt transaction if no call record
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(setConversationStatus).toHaveBeenCalledWith("CA_test_none", "completed");
    expect(deleteConversationState).toHaveBeenCalledWith("CA_test_none");
  });

  // -----------------------------------------------------------------------
  // Credit reconciliation
  // -----------------------------------------------------------------------

  it("should debit additional credits when cost increased (creditDiff > 0)", async () => {
    const { db } = await import("@/server/db");
    const { getConversationState, setConversationStatus, deleteConversationState } = await import(
      "@/server/services/telephony/conversationState"
    );

    (getConversationState as any).mockResolvedValue({
      messages: Array(10).fill({ role: "user", content: "test" }),
      turnCount: 10,
    });

    (db.call.findUnique as any).mockResolvedValue({
      id: "call-1",
      twilioCallSid: "CA_test",
      status: "ACTIVE",
      costCredits: 1, // Previously estimated 1 credit
      userId: "user-1",
      scenario: { characterId: "char-1" },
      user: { id: "user-1" },
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
        // Call duration is 120s = 2 min = 2 credits, but was 1, so creditDiff = 1
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    (db.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));
    (setConversationStatus as any).mockResolvedValue(undefined);
    (deleteConversationState as any).mockResolvedValue(undefined);

    const { POST } = await import("../route");

    const req = createFormDataRequest({
      CallSid: "CA_test",
      CallStatus: "completed",
      CallDuration: "120", // 2 minutes
    });

    await POST(req);

    // Should debit 1 credit (2 - 1 = 1)
    expect(mockTx.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", credits: { gte: 1 } },
      data: { credits: { decrement: 1 } },
    });
  });

  it("should refund credits when cost decreased (creditDiff < 0)", async () => {
    const { db } = await import("@/server/db");
    const { getConversationState, setConversationStatus, deleteConversationState } = await import(
      "@/server/services/telephony/conversationState"
    );

    (getConversationState as any).mockResolvedValue({
      messages: [{ role: "user", content: "Hi" }],
      turnCount: 1,
    });

    (db.call.findUnique as any).mockResolvedValue({
      id: "call-1",
      twilioCallSid: "CA_test",
      status: "ACTIVE",
      costCredits: 5, // Previously estimated 5 credits
      userId: "user-1",
      scenario: { characterId: "char-1" },
      user: { id: "user-1" },
    });

    const mockTx = {
      call: {
        findUnique: vi.fn().mockResolvedValue({
          id: "call-1",
          status: "ACTIVE",
          costCredits: 5,
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      user: {
        // Duration 30s = 1 min = 1 credit, but previously costCredits was 5, so creditDiff = -4
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    (db.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));
    (setConversationStatus as any).mockResolvedValue(undefined);
    (deleteConversationState as any).mockResolvedValue(undefined);

    const { POST } = await import("../route");

    const req = createFormDataRequest({
      CallSid: "CA_test",
      CallStatus: "completed",
      CallDuration: "30", // 30 seconds → 1 credit
    });

    await POST(req);

    // C-1: Refund now uses updateMany for consistency
    expect(mockTx.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { credits: { increment: 4 } },
    });
  });

  it("should handle failed additional debit gracefully (insufficient balance)", async () => {
    const { db } = await import("@/server/db");
    const { getConversationState, setConversationStatus, deleteConversationState } = await import(
      "@/server/services/telephony/conversationState"
    );

    (getConversationState as any).mockResolvedValue({
      messages: Array(10).fill({ role: "user", content: "test" }),
      turnCount: 10,
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
        // Debit fails — insufficient balance
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    (db.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));
    (setConversationStatus as any).mockResolvedValue(undefined);
    (deleteConversationState as any).mockResolvedValue(undefined);

    const { POST } = await import("../route");

    const req = createFormDataRequest({
      CallSid: "CA_test",
      CallStatus: "completed",
      CallDuration: "300", // 5 minutes = 5 credits, diff = 4
    });

    // Should not throw — the error is caught inside the handler
    const response = await POST(req);
    expect(response.status).toBe(200);
  });

  // -----------------------------------------------------------------------
  // Double-check idempotency inside transaction
  // -----------------------------------------------------------------------

  it("should abort transaction if call status already COMPLETED (double-check)", async () => {
    const { db } = await import("@/server/db");
    const { getConversationState, setConversationStatus, deleteConversationState } = await import(
      "@/server/services/telephony/conversationState"
    );

    (getConversationState as any).mockResolvedValue({
      messages: [{ role: "user", content: "Hello" }],
      turnCount: 1,
    });

    (db.call.findUnique as any).mockResolvedValue({
      id: "call-1",
      twilioCallSid: "CA_test",
      status: "ACTIVE", // First check passes
      costCredits: 1,
      userId: "user-1",
      scenario: { characterId: "char-1" },
      user: { id: "user-1" },
    });

    const mockTx = {
      call: {
        findUnique: vi.fn().mockResolvedValue({
          id: "call-1",
          status: "COMPLETED", // Second check inside transaction — already completed!
          costCredits: 1,
        }),
        update: vi.fn(),
      },
      user: {
        updateMany: vi.fn(),
        update: vi.fn(),
      },
    };

    let transactionCallbackExecuted = false;
    (db.$transaction as any).mockImplementation(async (cb: any) => {
      transactionCallbackExecuted = true;
      return cb(mockTx);
    });
    (setConversationStatus as any).mockResolvedValue(undefined);
    (deleteConversationState as any).mockResolvedValue(undefined);

    const { POST } = await import("../route");

    const req = createFormDataRequest({
      CallSid: "CA_test",
      CallStatus: "completed",
    });

    await POST(req);

    // The transaction callback was executed but should have returned early
    expect(transactionCallbackExecuted).toBe(true);
    // call.update should NOT have been called since status was COMPLETED
    expect(mockTx.call.update).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Call status: busy, no-answer, failed, canceled
  // -----------------------------------------------------------------------

  it.each([
    "busy",
    "no-answer",
    "failed",
    "canceled",
  ])("should handle %s status by failing the call", async (status) => {
    const { db } = await import("@/server/db");
    const { failCall } = await import("@/server/services/telephony/callLifecycle");
    const { setConversationStatus } = await import("@/server/services/telephony/conversationState");

    (db.call.findUnique as any).mockResolvedValue({
      id: "call-1",
      twilioCallSid: "CA_test",
    });
    (failCall as any).mockResolvedValue(undefined);
    (setConversationStatus as any).mockResolvedValue(undefined);

    const { POST } = await import("../route");

    const req = createFormDataRequest({
      CallSid: "CA_test",
      CallStatus: status,
      CallDuration: "45",
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    expect(db.call.findUnique).toHaveBeenCalledWith({
      where: { twilioCallSid: "CA_test" },
    });
    expect(failCall).toHaveBeenCalledWith("call-1", 45);
    expect(setConversationStatus).toHaveBeenCalledWith("CA_test", "failed");
  });

  it.each([
    "busy",
    "no-answer",
    "failed",
    "canceled",
  ])("should handle %s status when no call record exists", async (status) => {
    const { db } = await import("@/server/db");
    const { failCall } = await import("@/server/services/telephony/callLifecycle");
    const { setConversationStatus } = await import("@/server/services/telephony/conversationState");

    (db.call.findUnique as any).mockResolvedValue(null);
    (failCall as any).mockResolvedValue(undefined);
    (setConversationStatus as any).mockResolvedValue(undefined);

    const { POST } = await import("../route");

    const req = createFormDataRequest({
      CallSid: "CA_test_no_record",
      CallStatus: status,
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    // failCall should not be called if no record
    expect(failCall).not.toHaveBeenCalled();
    // But should still update conversation status
    expect(setConversationStatus).toHaveBeenCalledWith("CA_test_no_record", "failed");
  });

  // -----------------------------------------------------------------------
  // Call status: ringing, in-progress
  // -----------------------------------------------------------------------

  it.each([
    ["ringing", "RINGING"],
    ["in-progress", "ACTIVE"],
  ] as const)("should update status to %s when CallStatus is %s", async (callStatus, expectedStatus) => {
    const { db } = await import("@/server/db");

    (db.call.updateMany as any).mockResolvedValue({ count: 1 });

    const { POST } = await import("../route");

    const req = createFormDataRequest({
      CallSid: "CA_test",
      CallStatus: callStatus,
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    expect(db.call.updateMany).toHaveBeenCalledWith({
      where: { twilioCallSid: "CA_test" },
      data: { status: expectedStatus },
    });
  });

  it("should ignore initiated status (no update)", async () => {
    const { db } = await import("@/server/db");

    const { POST } = await import("../route");

    const req = createFormDataRequest({
      CallSid: "CA_test",
      CallStatus: "initiated",
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    // updateMany should not have been called for initiated
    expect(db.call.updateMany).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Recording fetch failure
  // -----------------------------------------------------------------------

  // -----------------------------------------------------------------------
  // SSRF protection: Recording URL validation
  // -----------------------------------------------------------------------

  it("should fetch recording from valid Twilio URL", async () => {
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

    // Valid Twilio recording URL must match:
    // hostname === "api.twilio.com"
    // pathname starts with "/2010-04-01/Accounts/"
    // pathname includes "/Recordings/"
    const validUrl = "https://api.twilio.com/2010-04-01/Accounts/AC_test/Recordings/RE123";

    // The route now uses twilioClient.request() instead of raw fetch
    mockTwilioRequest.mockResolvedValue({
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

    const req = createFormDataRequest({
      CallSid: "CA_test",
      CallStatus: "completed",
      RecordingUrl: validUrl,
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    // Should have called twilioClient.request with the valid Twilio URL
    expect(mockTwilioRequest).toHaveBeenCalledWith({
      method: "get",
      uri: validUrl,
    });
  });

  it("should reject non-Twilio recording URLs (SSRF protection)", async () => {
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

    // A malicious recording URL pointing to internal service
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

    const { POST } = await import("../route");

    const req = createFormDataRequest({
      CallSid: "CA_test",
      CallStatus: "completed",
      RecordingUrl: maliciousUrl,
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    // Should NOT have made any fetch or twilioClient.request calls for SSRF prevention
    expect(mockTwilioRequest).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should reject internal Twilio-like recording URLs (SSRF protection)", async () => {
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

    // Internal URL that mimics Twilio path structure but on private IP
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

    const req = createFormDataRequest({
      CallSid: "CA_test",
      CallStatus: "completed",
      RecordingUrl: internalUrl,
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    // Should NOT have made any fetch or twilioClient.request calls
    expect(mockTwilioRequest).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should handle recording fetch failure gracefully (valid URL but network error)", async () => {
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

    // Valid URL but Twilio SDK request fails
    const validUrl = "https://api.twilio.com/2010-04-01/Accounts/AC_test/Recordings/RE123";
    mockTwilioRequest.mockRejectedValue(new Error("Network error"));

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

    const req = createFormDataRequest({
      CallSid: "CA_test",
      CallStatus: "completed",
      RecordingUrl: validUrl,
    });

    // Should not throw — errors are caught
    const response = await POST(req);
    expect(response.status).toBe(200);

    // twilioClient.request was attempted (URL was valid)
    expect(mockTwilioRequest).toHaveBeenCalledWith({
      method: "get",
      uri: validUrl,
    });
  });
});
