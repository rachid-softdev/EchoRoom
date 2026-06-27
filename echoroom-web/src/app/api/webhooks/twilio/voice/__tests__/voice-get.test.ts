import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// C-2: voice/route.ts GET handler — No state leakage
// ---------------------------------------------------------------------------
// Tests that the GET handler:
//   - Always returns { active: false } regardless of input
//   - Does NOT leak conversation state, messages, or status details
//   - Handles no token, valid token, and invalid token the same way
//
// The GET handler is a health-check endpoint that should NEVER return
// conversation content. Full status is only available via authenticated
// tRPC endpoints.

vi.mock("@/server/db", () => ({
  db: {
    call: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    TWILIO_AUTH_TOKEN: "test_auth_token",
  },
}));

vi.mock("@/server/lib/twilioToken", () => ({
  verifyTwilioToken: vi.fn(),
  createTwilioToken: vi.fn(() => "mocked_token"),
}));

vi.mock("@/server/services/ai/conversationEngine", () => ({
  generateResponse: vi.fn(),
}));

vi.mock("@/server/services/audio/tts", () => ({
  ttsClient: null,
}));

vi.mock("@/server/services/telephony/conversationState", () => ({
  initConversationState: vi.fn(),
}));

vi.mock("@/server/services/audio/r2", () => ({
  uploadAudioBuffer: vi.fn(),
}));

vi.mock("../validate", () => ({
  validateTwilioRequest: vi.fn(),
  extractParams: vi.fn(),
}));

function createMockGetRequest(url: string): NextRequest {
  return {
    url,
    headers: {
      get: () => null,
    },
  } as unknown as NextRequest;
}

describe("C-2: GET handler — No state leakage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should always return { active: false }", async () => {
    const { GET } = await import("../route");

    const req = createMockGetRequest("https://api.echoroom.app/api/webhooks/twilio/voice");
    const response = await GET(req);

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ active: false });
  });

  it("should return { active: false } regardless of query params", async () => {
    const { GET } = await import("../route");

    // With various query params (should all be ignored)
    const req = createMockGetRequest(
      "https://api.echoroom.app/api/webhooks/twilio/voice?callSid=CA_test&token=some_token",
    );
    const response = await GET(req);

    const body = await response.json();
    expect(body).toEqual({ active: false });
  });

  it("should not include conversation state in the response body", async () => {
    const { GET } = await import("../route");

    const req = createMockGetRequest("https://api.echoroom.app/api/webhooks/twilio/voice");
    const response = await GET(req);

    const body = await response.json();

    // Verify no state leakage
    expect(body).not.toHaveProperty("messages");
    expect(body).not.toHaveProperty("callSid");
    expect(body).not.toHaveProperty("scenarioId");
    expect(body).not.toHaveProperty("characterId");
    expect(body).not.toHaveProperty("callerNumber");
    expect(body).not.toHaveProperty("turnCount");
    expect(body).not.toHaveProperty("status");
    expect(body).not.toHaveProperty("lastActiveAt");
  });

  it("should return 200 and correct Content-Type", async () => {
    const { GET } = await import("../route");

    const req = createMockGetRequest("https://api.echoroom.app/api/webhooks/twilio/voice");
    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");
  });

  it("should not make any database queries", async () => {
    const { db } = await import("@/server/db");
    const { GET } = await import("../route");

    const req = createMockGetRequest("https://api.echoroom.app/api/webhooks/twilio/voice");
    await GET(req);

    // GET handler should not touch the database
    expect(db.call.findUnique).not.toHaveBeenCalled();
  });
});
