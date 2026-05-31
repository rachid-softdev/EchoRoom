import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// M-1: conversationState — getSystemPromptFromState
// I-3: callId tracking — getCallId
// ---------------------------------------------------------------------------
// Tests for:
//   - getSystemPromptFromState returns system prompt from dedicated field (new)
//   - getSystemPromptFromState finds system message in messages array (legacy)
//   - getSystemPromptFromState falls back to DB query when neither available
//   - getSystemPromptFromState returns ultimate fallback default
//   - getCallId returns callId when set
//   - getCallId falls back to callSid when callId is not set

vi.mock("@/lib/redis", () => ({
  redis: {
    set: vi.fn().mockResolvedValue("OK"),
    get: vi.fn(),
    expire: vi.fn().mockResolvedValue(1),
    del: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock("@/server/lib/encryption", () => ({
  encryptPhoneNumber: vi.fn((phone: string) => `encrypted:${phone}`),
  decryptPhoneNumber: vi.fn((encrypted: string) => {
    if (encrypted.startsWith("encrypted:")) {
      return encrypted.replace("encrypted:", "");
    }
    throw new Error("Decryption failed");
  }),
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock db for the static import in conversationState.ts (H-3 change from dynamic to static import)
vi.mock("@/server/db", () => ({
  db: {
    scenario: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

import type { ConversationState } from "../conversationState";

function createState(overrides: Partial<ConversationState> = {}): ConversationState {
  return {
    callSid: "CA_test",
    scenarioId: "scenario-1",
    characterId: "char-1",
    callerNumber: "",
    messages: [],
    turnCount: 0,
    lastActiveAt: new Date().toISOString(),
    status: "active",
    ...overrides,
  };
}

describe("M-1: getSystemPromptFromState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return systemPrompt from dedicated field (new format)", async () => {
    const { getSystemPromptFromState } = await import("../conversationState");

    const state = createState({
      // @ts-expect-error — systemPrompt is a newer field added to ConversationState
      systemPrompt: "You are a dedicated system prompt",
      messages: [
        { role: "system", content: "This should be ignored" },
        { role: "user", content: "Hello" },
      ],
    });

    const result = await getSystemPromptFromState(state);
    expect(result).toBe("You are a dedicated system prompt");
  });

  it("should find system message in messages array (legacy format)", async () => {
    const { getSystemPromptFromState } = await import("../conversationState");

    const state = createState({
      messages: [
        { role: "system", content: "You are a legacy system prompt" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ],
    });

    const result = await getSystemPromptFromState(state);
    expect(result).toBe("You are a legacy system prompt");
  });

  it("should prefer dedicated systemPrompt over legacy messages", async () => {
    const { getSystemPromptFromState } = await import("../conversationState");

    const state = createState({
      // @ts-expect-error
      systemPrompt: "New format prompt — should be preferred",
      messages: [
        { role: "system", content: "Legacy format prompt — should be ignored" },
        { role: "user", content: "Hello" },
      ],
    });

    const result = await getSystemPromptFromState(state);
    expect(result).toBe("New format prompt — should be preferred");
  });

  it("should return fallback default when no system prompt available", async () => {
    const { getSystemPromptFromState } = await import("../conversationState");

    const state = createState({
      scenarioId: "unknown", // No DB fallback
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ],
    });

    const result = await getSystemPromptFromState(state);
    // Should return the ultimate fallback
    expect(result).toBe("Tu es un assistant IA amical. Réponds en français de manière naturelle.");
  });

  it("should try DB fallback when scenarioId is set but no prompt exists", async () => {
    const { db } = await import("@/server/db");
    // Configure the existing mock to return a scenario with character data
    (db.scenario.findUnique as any).mockResolvedValue({
      character: {
        name: "TestBot",
        description: "A test character",
        promptSystem: "Follow the rules",
      },
      aiInstructions: "Be helpful",
      description: "Test scenario context",
    });

    const { getSystemPromptFromState } = await import("../conversationState");

    const state = createState({
      scenarioId: "scenario-valid",
      messages: [], // No system prompt in messages
    });

    const result = await getSystemPromptFromState(state);
    // Should include character name from DB fallback
    expect(result).toContain("TestBot");
    expect(result).toContain("Follow the rules");
    expect(result).toContain("Be helpful");
  });
});

describe("I-3: getCallId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return callId when set", async () => {
    const { getCallId } = await import("../conversationState");

    const state = createState({
      // @ts-expect-error
      callId: "db-call-id-123",
      callSid: "CA_twilio-sid-456",
    });

    const result = getCallId(state);
    expect(result).toBe("db-call-id-123");
  });

  it("should fall back to callSid when callId is not set", async () => {
    const { getCallId } = await import("../conversationState");

    const state = createState({
      callSid: "CA_twilio-sid-789",
      // No callId set
    });

    const result = getCallId(state);
    expect(result).toBe("CA_twilio-sid-789");
  });

  it("should handle empty callId gracefully", async () => {
    const { getCallId } = await import("../conversationState");

    const state = createState({
      // @ts-expect-error
      callId: "",
      callSid: "CA_twilio-sid-000",
    });

    const result = getCallId(state);
    expect(result).toBe("CA_twilio-sid-000");
  });

  it("should prefer callId over callSid when both are set", async () => {
    const { getCallId } = await import("../conversationState");

    const state = createState({
      // @ts-expect-error
      callId: "preferred-call-id",
      callSid: "CA_secondary",
    });

    const result = getCallId(state);
    // callId should take priority
    expect(result).toBe("preferred-call-id");
    expect(result).not.toBe("CA_secondary");
  });
});
