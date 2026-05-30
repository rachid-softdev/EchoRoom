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

describe("initConversationState — N1 encryption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should encrypt callerNumber when storing conversation state", async () => {
    const { encryptPhoneNumber } = await import("@/server/lib/encryption");
    const { initConversationState } = await import("../conversationState");

    const result = await initConversationState("CA_test_encrypt", {
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
    vi.mocked(redis.get).mockResolvedValue(
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
    vi.mocked(redis.get).mockResolvedValue(
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
    vi.mocked(redis.get).mockResolvedValue(null);

    const { getCallerNumber } = await import("../conversationState");
    const result = await getCallerNumber("CA_test_nonexistent");

    expect(result).toBeNull();
  });

  it("should return null when callerNumber is empty", async () => {
    const { redis } = await import("@/lib/redis");
    vi.mocked(redis.get).mockResolvedValue(
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
      callSid: "CA_test_lifecycle",
      scenarioId: "scenario-1",
      characterId: "char-1",
      callerNumber: "+33698765432",
      messages: [{ role: "system", content: "You are a test bot" }],
    });

    expect(initialState).not.toBeNull();
    expect(initialState!.callerNumber).toBe("v1:encrypted:+33698765432");

    // Simulate Redis having the encrypted data
    vi.mocked(redis.get).mockResolvedValue(JSON.stringify(initialState));

    const retrieved = await getConversationState("CA_test_lifecycle");
    expect(retrieved).not.toBeNull();
    expect(retrieved!.callerNumber).toBe("v1:encrypted:+33698765432");
  });
});
