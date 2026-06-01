import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Conversation State Tests — N1 callerNumber encryption
// ---------------------------------------------------------------------------
// Tests for conversationState.ts:
//   - initConversationState encrypts callerNumber via encryptPhoneNumber
//   - getCallerNumber decrypts encrypted numbers and handles legacy plaintext
//
// Redis is mocked to avoid external dependency.
// Encryption is mocked to produce a deterministic "v1:encrypted:{phone}" format.

vi.mock("@/lib/redis", () => ({
  redis: {
    set: vi.fn().mockResolvedValue("OK"),
    get: vi.fn(),
    expire: vi.fn().mockResolvedValue(1),
    del: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock("@/server/lib/encryption", () => ({
  encryptPhoneNumber: vi.fn((phone: string) => `v1:encrypted:${phone}`),
  decryptPhoneNumber: vi.fn((encrypted: string) => {
    if (encrypted.startsWith("v1:encrypted:")) {
      return encrypted.replace("v1:encrypted:", "");
    }
    throw new Error("Decryption failed");
  }),
}));

// Mock the logger to suppress log output
vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock scenarioRepository to avoid the expensive @/server/repositories import chain
vi.mock("@/server/repositories", () => ({
  scenarioRepository: {
    findByIdWithCharacter: vi.fn(),
  },
}));

describe("initConversationState — N1 encryption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should encrypt callerNumber when storing conversation state", async () => {
    const { encryptPhoneNumber } = await import("@/server/lib/encryption");
    const { initConversationState } = await import("../conversationState");

    const result = await initConversationState("CA_test_encrypt", {
      callId: "test-call-id",
      callSid: "CA_test_encrypt",
      scenarioId: "scenario-1",
      characterId: "char-1",
      callerNumber: "+33612345678",
      messages: [],
    });

    expect(result).not.toBeNull();
    // Verify encryptPhoneNumber was called with the original number
    expect(encryptPhoneNumber).toHaveBeenCalledWith("+33612345678");
    // Verify the stored callerNumber is the encrypted version (starts with "v1:")
    expect(result!.callerNumber).toBe("v1:encrypted:+33612345678");
    expect(result!.callerNumber).not.toBe("+33612345678");
  });

  it("should handle empty callerNumber without calling encryption", async () => {
    const { encryptPhoneNumber } = await import("@/server/lib/encryption");
    const { initConversationState } = await import("../conversationState");

    const result = await initConversationState("CA_test_empty", {
      callId: "test-call-id",
      callSid: "CA_test_empty",
      scenarioId: "scenario-1",
      characterId: "char-1",
      callerNumber: "",
      messages: [],
    });

    expect(result).not.toBeNull();
    // Empty string is falsy — encryptPhoneNumber should NOT be called
    // (the source code uses: data.callerNumber ? encryptPhoneNumber(...) : "")
    expect(encryptPhoneNumber).not.toHaveBeenCalled();
    expect(result!.callerNumber).toBe("");
  });

  // NOTE: Testing `if (!redis) return null` null-Redis guard is impractical
  // with `vi.mock` hoisting (the mock is always a non-null object).
  // The source code in `conversationState.ts` has:
  //   if (!redis) return null;
  // This path is tested indirectly via integration/E2E tests only.
});

describe("getCallerNumber — N1 decryption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return decrypted number when state has encrypted callerNumber", async () => {
    const { redis } = await import("@/lib/redis");
    // Mock getConversationState via Redis to return encrypted callerNumber
    vi.mocked(redis!.get).mockResolvedValue(
      JSON.stringify({
        callSid: "CA_test",
        scenarioId: "scenario-1",
        characterId: "char-1",
        callerNumber: "v1:encrypted:+33612345678",
        messages: [],
        turnCount: 0,
        lastActiveAt: new Date().toISOString(),
        status: "active",
      }),
    );

    const { getCallerNumber } = await import("../conversationState");
    const result = await getCallerNumber("CA_test");

    expect(result).toBe("+33612345678");
  });

  it("should return plaintext for legacy unencrypted callerNumber", async () => {
    const { redis } = await import("@/lib/redis");
    // Mock Redis to return plaintext callerNumber (legacy data)
    vi.mocked(redis!.get).mockResolvedValue(
      JSON.stringify({
        callSid: "CA_test_legacy",
        scenarioId: "scenario-1",
        characterId: "char-1",
        callerNumber: "+33612345678",
        messages: [],
        turnCount: 0,
        lastActiveAt: new Date().toISOString(),
        status: "active",
      }),
    );

    const { getCallerNumber } = await import("../conversationState");
    const result = await getCallerNumber("CA_test_legacy");

    // Legacy plaintext should be returned as-is since decryptPhoneNumber throws
    expect(result).toBe("+33612345678");
  });

  it("should return null when conversation state does not exist", async () => {
    const { redis } = await import("@/lib/redis");
    vi.mocked(redis!.get).mockResolvedValue(null);

    const { getCallerNumber } = await import("../conversationState");
    const result = await getCallerNumber("CA_test_nonexistent");

    expect(result).toBeNull();
  });

  it("should return null when callerNumber is empty", async () => {
    const { redis } = await import("@/lib/redis");
    vi.mocked(redis!.get).mockResolvedValue(
      JSON.stringify({
        callSid: "CA_test_empty",
        scenarioId: "scenario-1",
        characterId: "char-1",
        callerNumber: "",
        messages: [],
        turnCount: 0,
        lastActiveAt: new Date().toISOString(),
        status: "active",
      }),
    );

    const { getCallerNumber } = await import("../conversationState");
    const result = await getCallerNumber("CA_test_empty");

    expect(result).toBeNull();
  });
});

describe("conversationState lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should store and retrieve the full conversation state with encrypted number", async () => {
    const { redis } = await import("@/lib/redis");
    const { initConversationState, getConversationState } = await import("../conversationState");

    // init should encrypt and store
    const initialState = await initConversationState("CA_test_lifecycle", {
      callId: "test-call-id",
      callSid: "CA_test_lifecycle",
      scenarioId: "scenario-1",
      characterId: "char-1",
      callerNumber: "+33698765432",
      messages: [{ role: "system", content: "You are a test bot" }],
    });

    expect(initialState).not.toBeNull();
    expect(initialState!.callerNumber).toBe("v1:encrypted:+33698765432");

    // Simulate Redis having the encrypted data
    vi.mocked(redis!.get).mockResolvedValue(JSON.stringify(initialState));

    const retrieved = await getConversationState("CA_test_lifecycle");
    expect(retrieved).not.toBeNull();
    expect(retrieved!.callerNumber).toBe("v1:encrypted:+33698765432");
  });
});

describe("appendMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should append a message to existing state and update lastActiveAt", async () => {
    const { redis } = await import("@/lib/redis");
    const { appendMessage } = await import("../conversationState");

    // Seed Redis with initial state
    const existingState = {
      callSid: "CA_test_append",
      scenarioId: "scenario-1",
      characterId: "char-1",
      callerNumber: "",
      messages: [{ role: "user", content: "Hello" }],
      turnCount: 0,
      lastActiveAt: new Date().toISOString(),
      status: "active",
    };
    vi.mocked(redis!.get).mockResolvedValue(JSON.stringify(existingState));
    vi.mocked(redis!.set).mockResolvedValue("OK");

    const result = await appendMessage("CA_test_append", {
      role: "assistant",
      content: "Hi there!",
    });

    expect(result).not.toBeNull();
    expect(result!.messages).toHaveLength(2);
    expect(result!.messages[0]).toEqual({ role: "user", content: "Hello" });
    expect(result!.messages[1]).toEqual({ role: "assistant", content: "Hi there!" });
    // lastActiveAt should be updated (newer than original)
    expect(new Date(result!.lastActiveAt).getTime()).toBeGreaterThanOrEqual(
      new Date(existingState.lastActiveAt).getTime(),
    );
  });

  it("should return null when conversation state does not exist", async () => {
    const { redis } = await import("@/lib/redis");
    vi.mocked(redis!.get).mockResolvedValue(null);

    const { appendMessage } = await import("../conversationState");
    const result = await appendMessage("CA_test_nonexistent", {
      role: "assistant",
      content: "Hello",
    });

    expect(result).toBeNull();
  });

  it("should persist the updated state to Redis with TTL", async () => {
    const { redis } = await import("@/lib/redis");
    const { appendMessage } = await import("../conversationState");
    const { CONVERSATION_TTL_S } = await import("../constants");

    const existingState = {
      callSid: "CA_test_persist",
      scenarioId: "scenario-1",
      characterId: "char-1",
      callerNumber: "",
      messages: [],
      turnCount: 0,
      lastActiveAt: new Date().toISOString(),
      status: "active",
    };
    vi.mocked(redis!.get).mockResolvedValue(JSON.stringify(existingState));
    vi.mocked(redis!.set).mockResolvedValue("OK");

    await appendMessage("CA_test_persist", { role: "user", content: "Test" });

    expect(redis!.set).toHaveBeenCalledWith(
      "conversation:CA_test_persist",
      expect.any(String),
      { ex: CONVERSATION_TTL_S },
    );
  });
});

describe("incrementTurn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should increment turnCount by 1", async () => {
    const { redis } = await import("@/lib/redis");
    const { incrementTurn } = await import("../conversationState");

    const existingState = {
      callSid: "CA_test_turn",
      scenarioId: "scenario-1",
      characterId: "char-1",
      callerNumber: "",
      messages: [],
      turnCount: 5,
      lastActiveAt: new Date().toISOString(),
      status: "active",
    };
    vi.mocked(redis!.get).mockResolvedValue(JSON.stringify(existingState));
    vi.mocked(redis!.set).mockResolvedValue("OK");

    const result = await incrementTurn("CA_test_turn");

    expect(result).not.toBeNull();
    expect(result!.turnCount).toBe(6);
  });

  it("should return null when state does not exist", async () => {
    const { redis } = await import("@/lib/redis");
    vi.mocked(redis!.get).mockResolvedValue(null);

    const { incrementTurn } = await import("../conversationState");
    const result = await incrementTurn("CA_test_nonexistent");

    expect(result).toBeNull();
  });

  it("should handle increment from zero", async () => {
    const { redis } = await import("@/lib/redis");
    const { incrementTurn } = await import("../conversationState");

    const existingState = {
      callSid: "CA_test_zero",
      scenarioId: "scenario-1",
      characterId: "char-1",
      callerNumber: "",
      messages: [],
      turnCount: 0,
      lastActiveAt: new Date().toISOString(),
      status: "active",
    };
    vi.mocked(redis!.get).mockResolvedValue(JSON.stringify(existingState));

    const result = await incrementTurn("CA_test_zero");
    expect(result!.turnCount).toBe(1);
  });
});

describe("setConversationStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update the status field", async () => {
    const { redis } = await import("@/lib/redis");
    const { setConversationStatus } = await import("../conversationState");

    const existingState = {
      callSid: "CA_test_status",
      scenarioId: "scenario-1",
      characterId: "char-1",
      callerNumber: "",
      messages: [],
      turnCount: 0,
      lastActiveAt: new Date().toISOString(),
      status: "active",
    };
    vi.mocked(redis!.get).mockResolvedValue(JSON.stringify(existingState));
    vi.mocked(redis!.set).mockResolvedValue("OK");

    const result = await setConversationStatus("CA_test_status", "completed");

    expect(result).not.toBeNull();
    expect(result!.status).toBe("completed");
  });

  it("should return null when state does not exist", async () => {
    const { redis } = await import("@/lib/redis");
    vi.mocked(redis!.get).mockResolvedValue(null);

    const { setConversationStatus } = await import("../conversationState");
    const result = await setConversationStatus("CA_test_nonexistent", "completed");

    expect(result).toBeNull();
  });

  it("should handle all status transitions", async () => {
    const { redis } = await import("@/lib/redis");
    const { setConversationStatus } = await import("../conversationState");

    const baseState = {
      callSid: "CA_test_transitions",
      scenarioId: "scenario-1",
      characterId: "char-1",
      callerNumber: "",
      messages: [],
      turnCount: 0,
      lastActiveAt: new Date().toISOString(),
      status: "active",
    };

    vi.mocked(redis!.get).mockResolvedValue(JSON.stringify(baseState));
    vi.mocked(redis!.set).mockResolvedValue("OK");

    const statuses: Array<"active" | "completed" | "timed_out" | "failed"> = [
      "active", "completed", "timed_out", "failed",
    ];

    for (const s of statuses) {
      vi.mocked(redis!.get).mockResolvedValue(JSON.stringify(baseState));
      const result = await setConversationStatus("CA_test_transitions", s);
      expect(result!.status).toBe(s);
    }
  });
});

describe("deleteConversationState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete the Redis key for the given callSid", async () => {
    const { redis } = await import("@/lib/redis");
    const { deleteConversationState } = await import("../conversationState");

    vi.mocked(redis!.del).mockResolvedValue(1);

    await deleteConversationState("CA_test_delete");

    expect(redis!.del).toHaveBeenCalledWith("conversation:CA_test_delete");
    expect(redis!.del).toHaveBeenCalledTimes(1);
  });

  it("should not throw when deleting a non-existent key", async () => {
    const { redis } = await import("@/lib/redis");
    const { deleteConversationState } = await import("../conversationState");

    vi.mocked(redis!.del).mockResolvedValue(0);

    await expect(
      deleteConversationState("CA_test_nonexistent"),
    ).resolves.toBeUndefined();
  });
});
