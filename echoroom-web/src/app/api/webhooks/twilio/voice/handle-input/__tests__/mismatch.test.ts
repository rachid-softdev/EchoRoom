import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// M-7: handle-input scenarioId mismatch rejection
// ---------------------------------------------------------------------------
// Tests that:
//   - When scenarioId in token differs from Redis state → hangup TwiML with error
//   - Response Content-Type is text/xml
//   - When scenarioId matches → conversation continues normally
//   - When state.scenarioId is empty → continues (no mismatch possible)
//   - When scenarioId is 'unknown' → continues (no mismatch possible)

vi.mock("@/server/db", () => ({
  db: {
    scenario: { findUnique: vi.fn() },
    character: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    TWILIO_AUTH_TOKEN: "test_auth_token",
  },
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock("@/server/lib/twilioToken", () => ({
  verifyTwilioToken: vi.fn(),
  createTwilioToken: vi.fn(() => "mocked_new_token"),
}));

vi.mock("../../../validate", () => ({
  validateTwilioRequest: vi.fn(),
  extractParams: vi.fn(),
}));

vi.mock("@/server/services/telephony/conversationState", () => ({
  getConversationState: vi.fn(),
  appendMessage: vi.fn(),
  incrementTurn: vi.fn(),
  setConversationStatus: vi.fn(),
  getSystemPromptFromState: vi.fn(),
  getCallId: vi.fn(),
}));

vi.mock("@/server/services/ai/conversationEngine", () => ({
  generateResponse: vi.fn(),
}));

vi.mock("@/server/services/telephony/goodbyeDetector", () => ({
  detectGoodbye: vi.fn(() => false),
}));

vi.mock("@/server/services/ai/moderation", () => ({
  checkContent: vi.fn().mockResolvedValue({ approved: true }),
}));

vi.mock("@/server/services/audio/tts", () => ({
  ttsClient: null,
}));

vi.mock("@/server/services/audio/r2", () => ({
  uploadAudioBuffer: vi.fn(),
}));

// Mock the rate limit module used by the handle-input route
vi.mock("../../../../rateLimit", () => ({
  checkWebhookRateLimit: vi.fn().mockResolvedValue(true),
}));

import type { ConversationState } from "@/server/services/telephony/conversationState";

function createBaseState(overrides: Partial<ConversationState> = {}): ConversationState {
  return {
    callSid: "CA_test",
    scenarioId: "scenario-redis-123",
    characterId: "char-1",
    callerNumber: "",
    messages: [{ role: "system", content: "You are a test bot" }],
    turnCount: 0,
    lastActiveAt: new Date().toISOString(),
    status: "active",
    ...overrides,
  };
}

function createMockRequest(
  searchParams: string,
  formFields: Record<string, string> = { CallSid: "CA_test", SpeechResult: "hello" },
): NextRequest {
  const formData = new Map(Object.entries(formFields)) as unknown as FormData;
  return {
    formData: () => Promise.resolve(formData),
    headers: {
      get: (name: string) => {
        if (name === "x-twilio-signature") return "valid_sig";
        if (name === "content-length") return "500";
        return null;
      },
    },
    url: `https://api.echoroom.app/api/webhooks/twilio/voice/handle-input?${searchParams}`,
  } as unknown as NextRequest;
}

describe("M-7: scenarioId mismatch rejection", () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    const { validateTwilioRequest, extractParams } = await import("../../../validate");
    (validateTwilioRequest as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (extractParams as ReturnType<typeof vi.fn>).mockReturnValue({ CallSid: "CA_test", SpeechResult: "hello" });

    const { verifyTwilioToken } = await import("@/server/lib/twilioToken");
    (verifyTwilioToken as ReturnType<typeof vi.fn>).mockReturnValue({
      callId: "call-1",
      scenarioId: "scenario-token-999", // Different from Redis state
      iat: Date.now(),
    });

    const { getConversationState, getSystemPromptFromState, getCallId } = await import(
      "@/server/services/telephony/conversationState",
    );
    (getConversationState as ReturnType<typeof vi.fn>).mockResolvedValue(createBaseState());
    (getSystemPromptFromState as ReturnType<typeof vi.fn>).mockResolvedValue("You are a test assistant");
    (getCallId as ReturnType<typeof vi.fn>).mockReturnValue("call-1");

    const { generateResponse } = await import("@/server/services/ai/conversationEngine");
    (generateResponse as ReturnType<typeof vi.fn>).mockResolvedValue({ response: "Hello from AI" });
  });

  it("should return hangup TwiML when scenarioId differs from Redis state", async () => {
    const { POST } = await import("../route");

    // Token scenarioId = "scenario-token-999", Redis state scenarioId = "scenario-redis-123"
    const req = createMockRequest("token=mocked_token");
    const response = await POST(req);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/xml");

    const text = await response.text();
    expect(text).toContain("<Hangup/>");
    expect(text).toContain("Erreur de conversation");
  });

  it("should continue normally when scenarioId matches Redis state", async () => {
    const { verifyTwilioToken } = await import("@/server/lib/twilioToken");
    // Make token scenarioId match Redis state
    (verifyTwilioToken as ReturnType<typeof vi.fn>).mockReturnValue({
      callId: "call-1",
      scenarioId: "scenario-redis-123", // Same as Redis state
      iat: Date.now(),
    });

    const { POST } = await import("../route");

    const req = createMockRequest("token=mocked_token");
    const response = await POST(req);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/xml");

    const text = await response.text();
    // Should NOT contain error message or hangup
    expect(text).not.toContain("Erreur de conversation");
    expect(text).not.toContain("<Hangup/>");
    // Should contain a gather (next turn) or say verb
    expect(text).toContain("<Response>");
  });

  it("should continue when state.scenarioId is empty", async () => {
    const { getConversationState } = await import(
      "@/server/services/telephony/conversationState",
    );
    (getConversationState as ReturnType<typeof vi.fn>).mockResolvedValue(
      createBaseState({ scenarioId: "" }),
    );

    const { POST } = await import("../route");

    const req = createMockRequest("token=mocked_token");
    const response = await POST(req);

    expect(response.status).toBe(200);

    const text = await response.text();
    expect(text).not.toContain("Erreur de conversation");
  });

  it("should continue when scenarioId is 'unknown'", async () => {
    const { verifyTwilioToken } = await import("@/server/lib/twilioToken");
    (verifyTwilioToken as ReturnType<typeof vi.fn>).mockReturnValue({
      callId: "call-1",
      scenarioId: "unknown",
      iat: Date.now(),
    });

    const { POST } = await import("../route");

    const req = createMockRequest("token=mocked_token");
    const response = await POST(req);

    expect(response.status).toBe(200);

    const text = await response.text();
    expect(text).not.toContain("Erreur de conversation");
  });

  it("should continue when scenarioId is the same as Redis scenarioId", async () => {
    // Already set in beforeEach to match
    const { verifyTwilioToken } = await import("@/server/lib/twilioToken");
    (verifyTwilioToken as ReturnType<typeof vi.fn>).mockReturnValue({
      callId: "call-1",
      scenarioId: "scenario-redis-123",
      iat: Date.now(),
    });

    const { POST } = await import("../route");

    const req = createMockRequest("token=mocked_token");
    const response = await POST(req);

    expect(response.status).toBe(200);

    const text = await response.text();
    // Should get normal conversation flow
    expect(text).toContain("<Response>");
    expect(text).not.toContain("Erreur de conversation");
    expect(text).not.toContain("<Hangup/>");
  });
});
