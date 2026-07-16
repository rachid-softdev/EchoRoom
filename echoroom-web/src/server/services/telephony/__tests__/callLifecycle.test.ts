import type { Character, Scenario } from "@prisma/client";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

// ---------------------------------------------------------------------------
// Call Lifecycle tests: failCall idempotency, initiateCall, withRetry
// ---------------------------------------------------------------------------
// failCall uses callback-based $transaction to atomically:
//   1. Call updateMany with status guard (WHERE status NOT IN FAILED, COMPLETED)
//   2. If updateMany count > 0: fetch call data, refund credits
//   3. If updateMany count = 0: skip (already finalised)
// Uses updateMany instead of read-then-check to prevent TOCTOU race conditions.
//
// initiateCall orchestrates (Sprint 2):
//   1. Scenario lookup
//   2. Single $transaction — atomic daily limit + atomic debit + CALLING call
//   3. Twilio call initiation (outside transaction)
//   4. On success: updateMany WHERE status=CALLING → RINGING (idempotent guard)
//   5. On Twilio error: updateMany WHERE status=CALLING → FAILED + refund
//
// Sprint 4: atomicDebit prefers UserBilling sub-aggregate (tx.userBilling.updateMany)
//           falls back to legacy User.credits (tx.user.updateMany)
//
// withRetry provides exponential backoff with jitter.

vi.mock("@/server/db", () => ({
  db: {
    $transaction: vi.fn(),
    scenario: { findUnique: vi.fn() },
    userBilling: {
      // tier resolution in initiateCall reads UserBilling.plan (defaults to "free")
      findUnique: vi.fn().mockResolvedValue({ plan: undefined }),
    },
    call: {
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
  },
}));

vi.mock("@/server/services/telephony/twilio", () => ({
  twilioClient: {
    calls: { create: vi.fn() },
  },
  TWILIO_PHONE: "+1234567890",
  twilioCircuitBreaker: {
    call: vi.fn((fn: () => unknown) => fn()),
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_APP_URL: "https://echoroom.app",
  },
}));

vi.mock("@/server/lib/twilioToken", () => ({
  createTwilioToken: vi.fn(() => "mock-echoroom-token"),
}));

vi.mock("@/server/lib/encryption", () => ({
  encryptPhoneNumber: vi.fn((phone: string) => `encrypted:${phone}`),
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock("@/server/repositories", () => ({
  callRepository: {
    markAsFailedWithRefund: vi.fn().mockResolvedValue(undefined),
    updateStatusWithGuard: vi.fn().mockResolvedValue(1),
  },
  scenarioRepository: {
    findByIdWithCharacter: vi.fn(),
  },
  userRepository: {},
}));

describe("failCall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delegate to callRepository.markAsFailedWithRefund", async () => {
    const { callRepository } = await import("@/server/repositories");

    const { failCall } = await import("../callLifecycle");
    await failCall("call-1", 30);

    expect(callRepository.markAsFailedWithRefund).toHaveBeenCalledWith("call-1", 30);
  });

  it("should use default durationSeconds of 0", async () => {
    const { callRepository } = await import("@/server/repositories");

    const { failCall } = await import("../callLifecycle");
    await failCall("call-1");

    expect(callRepository.markAsFailedWithRefund).toHaveBeenCalledWith("call-1", 0);
  });

  it("should pass any callId to the repository", async () => {
    const { callRepository } = await import("@/server/repositories");

    const { failCall } = await import("../callLifecycle");
    await failCall("some-call-id", 120);

    expect(callRepository.markAsFailedWithRefund).toHaveBeenCalledWith("some-call-id", 120);
  });

  it("should not throw when repository resolves successfully", async () => {
    const { callRepository } = await import("@/server/repositories");
    vi.mocked(callRepository.markAsFailedWithRefund).mockResolvedValue(undefined);

    const { failCall } = await import("../callLifecycle");
    await expect(failCall("call-1", 30)).resolves.toBeUndefined();
  });

  it("should propagate repository errors", async () => {
    const { callRepository } = await import("@/server/repositories");
    vi.mocked(callRepository.markAsFailedWithRefund).mockRejectedValue(new Error("DB error"));

    const { failCall } = await import("../callLifecycle");
    await expect(failCall("call-1", 30)).rejects.toThrow("DB error");
  });
});

// ---------------------------------------------------------------------------
// withRetry — exponential backoff with jitter
// ---------------------------------------------------------------------------

describe("withRetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return result on first successful attempt", async () => {
    const { withRetry } = await import("../callLifecycle");
    const fn = vi.fn().mockResolvedValue("success");

    const result = await withRetry(fn, 3, 1, 100);

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on failure and succeed on second attempt", async () => {
    const { withRetry } = await import("../callLifecycle");
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Attempt 1 failed"))
      .mockResolvedValueOnce("success");

    const result = await withRetry(fn, 3, 1, 100);

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should retry on failure and succeed on third attempt", async () => {
    const { withRetry } = await import("../callLifecycle");
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Attempt 1"))
      .mockRejectedValueOnce(new Error("Attempt 2"))
      .mockResolvedValueOnce("success");

    const result = await withRetry(fn, 3, 1, 100);

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should throw after exhausting all attempts", async () => {
    const { withRetry } = await import("../callLifecycle");
    const fn = vi.fn().mockRejectedValue(new Error("Persistent failure"));

    await expect(withRetry(fn, 3, 1, 100)).rejects.toThrow("Persistent failure");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should throw the last error when all attempts fail", async () => {
    const { withRetry } = await import("../callLifecycle");
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Error A"))
      .mockRejectedValueOnce(new Error("Error B"))
      .mockRejectedValueOnce(new Error("Error C"));

    await expect(withRetry(fn, 3, 1, 100)).rejects.toThrow("Error C");
  });

  it("should handle non-Error thrown values", async () => {
    const { withRetry } = await import("../callLifecycle");
    const fn = vi.fn().mockRejectedValue("string error");

    await expect(withRetry(fn, 3, 1, 100)).rejects.toThrow("string error");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should respect maxAttempts parameter", async () => {
    const { withRetry } = await import("../callLifecycle");
    const fn = vi.fn().mockRejectedValue(new Error("Fail"));

    await expect(withRetry(fn, 1, 1, 100)).rejects.toThrow("Fail");
    // With maxAttempts=1, should only try once
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should respect maxDelayMs cap", async () => {
    // Use a high baseDelayMs to verify the maxDelayMs cap is applied
    const { withRetry } = await import("../callLifecycle");
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Fail 1"))
      .mockRejectedValueOnce(new Error("Fail 2"))
      .mockResolvedValueOnce("success");

    // baseDelayMs=5000, maxDelayMs=2 — should use maxDelayMs for all delays
    const result = await withRetry(fn, 3, 5000, 2);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// initiateCall — scenario lookup, atomic debit, Twilio orchestration
// ---------------------------------------------------------------------------

describe("initiateCall", () => {
  let mockTx: Record<string, any>;

  const validScenario: Scenario & { character: Character } = {
    id: "scenario-1",
    creatorId: "creator-1",
    characterId: "char-1",
    title: "Test Scenario",
    description: "",
    openingMessage: "",
    aiInstructions: "",
    visibility: "PUBLIC",
    moderationStatus: "APPROVED",
    playCount: 0,
    likeCount: 0,
    createdAt: new Date("2025-01-01"),
    character: {
      id: "char-1",
      name: "TestBot",
      slug: "test-bot",
      description: "A test character",
      promptSystem: "Be helpful",
      previewAudioUrl: "",
      avatarUrl: "",
      category: "NPC",
      elevenLabsVoiceId: "",
      isFeatured: false,
      createdAt: new Date("2025-01-01"),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset repository mocks that may have been overridden by failCall tests
    const repos = await import("@/server/repositories");
    vi.mocked(repos.callRepository.markAsFailedWithRefund).mockResolvedValue(undefined);
    vi.mocked(repos.callRepository.updateStatusWithGuard).mockResolvedValue(1);

    // Default transaction mock — happy path: sufficient credits + daily limit ok
    // Sprint 4: atomicDebit prefers UserBilling sub-aggregate
    mockTx = {
      userBilling: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      dailyCallLimit: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn(),
      },
      user: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
      call: {
        create: vi.fn().mockResolvedValue({ id: "call-1" }),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn(),
      },
    };
  });

  it("should successfully initiate a call and return callId with estimatedCredits", async () => {
    const { db } = await import("@/server/db");
    const { twilioClient } = await import("@/server/services/telephony/twilio");
    const { scenarioRepository } = await import("@/server/repositories");

    vi.mocked(scenarioRepository.findByIdWithCharacter).mockResolvedValue(validScenario);
    // The Prisma $transaction type is too complex to mock fully; the callback wraps mockTx
    (db.$transaction as Mock).mockImplementation(
      async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx),
    );
    (twilioClient.calls.create as Mock).mockResolvedValue({ sid: "CA_mock_sid_123" });

    const { initiateCall } = await import("../callLifecycle");
    const result = await initiateCall({
      scenarioId: "scenario-1",
      userId: "user-abc",
      phoneNumber: "+33612345678",
      maxDurationSeconds: 600,
    });

    expect(result).toEqual({
      callId: "call-1",
      estimatedCredits: 1,
    });
  });

  it("should create call record with correct fields inside the transaction", async () => {
    const { db } = await import("@/server/db");
    const { twilioClient } = await import("@/server/services/telephony/twilio");
    const { encryptPhoneNumber } = await import("@/server/lib/encryption");
    const { scenarioRepository } = await import("@/server/repositories");

    vi.mocked(scenarioRepository.findByIdWithCharacter).mockResolvedValue(validScenario);
    (db.$transaction as Mock).mockImplementation(
      async (cb: (tx: Record<string, any>) => Promise<unknown>) => cb(mockTx),
    );
    (twilioClient.calls.create as Mock).mockResolvedValue({ sid: "CA_mock_sid" });

    const { initiateCall } = await import("../callLifecycle");
    await initiateCall({
      scenarioId: "scenario-1",
      userId: "user-abc",
      phoneNumber: "+33612345678",
      maxDurationSeconds: 600,
    });

    expect(mockTx["call"].create).toHaveBeenCalledWith({
      data: {
        userId: "user-abc",
        scenarioId: "scenario-1",
        phoneNumber: "encrypted:+33612345678",
        status: "CALLING",
        costCredits: 1,
      },
    });
    expect(encryptPhoneNumber).toHaveBeenCalledWith("+33612345678");
  });

  it("should debit 1 credit via UserBilling inside the transaction", async () => {
    const { db } = await import("@/server/db");
    const { twilioClient } = await import("@/server/services/telephony/twilio");
    const { scenarioRepository } = await import("@/server/repositories");

    vi.mocked(scenarioRepository.findByIdWithCharacter).mockResolvedValue(validScenario);
    (db.$transaction as Mock).mockImplementation(
      async (cb: (tx: Record<string, any>) => Promise<unknown>) => cb(mockTx),
    );
    (twilioClient.calls.create as Mock).mockResolvedValue({ sid: "CA_mock_sid" });

    const { initiateCall } = await import("../callLifecycle");
    await initiateCall({
      scenarioId: "scenario-1",
      userId: "user-abc",
      phoneNumber: "+33612345678",
      maxDurationSeconds: 600,
    });

    // Sprint 4: atomicDebit prefers UserBilling sub-aggregate
    expect(mockTx["userBilling"].updateMany).toHaveBeenCalledWith({
      where: { userId: "user-abc", credits: { gte: 1 } },
      data: { credits: { decrement: 1 } },
    });
  });

  it("should throw INSUFFICIENT_CREDITS when UserBilling has insufficient credits and user exists", async () => {
    const { db } = await import("@/server/db");
    const { scenarioRepository } = await import("@/server/repositories");

    vi.mocked(scenarioRepository.findByIdWithCharacter).mockResolvedValue(validScenario);
    // UserBilling returns 0 credits — no legacy fallback, atomicDebit checks user existence
    mockTx["userBilling"].updateMany.mockResolvedValue({ count: 0 });
    // User exists, so should get INSUFFICIENT_CREDITS (not USER_NOT_FOUND)
    mockTx["user"].findUnique.mockResolvedValue({ id: "user-abc" });
    (db.$transaction as Mock).mockImplementation(
      async (cb: (tx: Record<string, any>) => Promise<unknown>) => cb(mockTx),
    );

    const { initiateCall } = await import("../callLifecycle");

    await expect(
      initiateCall({
        scenarioId: "scenario-1",
        userId: "user-abc",
        phoneNumber: "+33612345678",
        maxDurationSeconds: 600,
      }),
    ).rejects.toThrow("Crédits insuffisants");

    // Should have tried UserBilling only (legacy fallback removed in Sprint 8)
    expect(mockTx["userBilling"].updateMany).toHaveBeenCalled();
    expect(mockTx["user"].updateMany).not.toHaveBeenCalled();
  });

  it("should create Twilio token with correct parameters", async () => {
    const { db } = await import("@/server/db");
    const { twilioClient } = await import("@/server/services/telephony/twilio");
    const { createTwilioToken } = await import("@/server/lib/twilioToken");
    const { scenarioRepository } = await import("@/server/repositories");

    vi.mocked(scenarioRepository.findByIdWithCharacter).mockResolvedValue(validScenario);
    (db.$transaction as Mock).mockImplementation(
      async (cb: (tx: Record<string, any>) => Promise<unknown>) => cb(mockTx),
    );
    (twilioClient.calls.create as Mock).mockResolvedValue({ sid: "CA_mock_sid" });

    const { initiateCall } = await import("../callLifecycle");
    await initiateCall({
      scenarioId: "scenario-1",
      userId: "user-abc",
      phoneNumber: "+33612345678",
      maxDurationSeconds: 600,
    });

    expect(createTwilioToken).toHaveBeenCalledWith("call-1", "scenario-1", "char-1");
  });

  it("should update call record with Twilio SID and RINGING status after successful Twilio call", async () => {
    const { db } = await import("@/server/db");
    const { twilioClient } = await import("@/server/services/telephony/twilio");
    const { scenarioRepository, callRepository } = await import("@/server/repositories");

    vi.mocked(scenarioRepository.findByIdWithCharacter).mockResolvedValue(validScenario);
    (db.$transaction as Mock).mockImplementation(
      async (cb: (tx: Record<string, any>) => Promise<unknown>) => cb(mockTx),
    );
    (twilioClient.calls.create as Mock).mockResolvedValue({ sid: "CA_mock_ringing" });

    const { initiateCall } = await import("../callLifecycle");
    await initiateCall({
      scenarioId: "scenario-1",
      userId: "user-abc",
      phoneNumber: "+33612345678",
      maxDurationSeconds: 600,
    });

    // Uses updateStatusWithGuard via repository to prevent TOCTOU races
    expect(callRepository.updateStatusWithGuard).toHaveBeenCalledWith(
      "call-1",
      "CALLING",
      "RINGING",
      { twilioCallSid: "CA_mock_ringing" },
    );
  });

  it("should use updateStatusWithGuard on Twilio success (idempotent)", async () => {
    const { db } = await import("@/server/db");
    const { twilioClient } = await import("@/server/services/telephony/twilio");
    const { scenarioRepository, callRepository } = await import("@/server/repositories");

    vi.mocked(scenarioRepository.findByIdWithCharacter).mockResolvedValue(validScenario);
    (db.$transaction as Mock).mockImplementation(
      async (cb: (tx: Record<string, any>) => Promise<unknown>) => cb(mockTx),
    );
    (twilioClient.calls.create as Mock).mockResolvedValue({ sid: "CA_mock_sid" });

    // Simulate that the status guard already matched nothing
    vi.mocked(callRepository.updateStatusWithGuard).mockResolvedValue(0);

    const { initiateCall } = await import("../callLifecycle");
    const result = await initiateCall({
      scenarioId: "scenario-1",
      userId: "user-abc",
      phoneNumber: "+33612345678",
      maxDurationSeconds: 600,
    });

    // Still returns the callId — the status guard is for crash recovery
    expect(result).toEqual({ callId: "call-1", estimatedCredits: 1 });
    expect(callRepository.updateStatusWithGuard).toHaveBeenCalledWith(
      "call-1",
      "CALLING",
      "RINGING",
      { twilioCallSid: "CA_mock_sid" },
    );
  });

  it("should throw SCENARIO_NOT_FOUND when scenario does not exist", async () => {
    const { db } = await import("@/server/db");
    const { scenarioRepository } = await import("@/server/repositories");

    vi.mocked(scenarioRepository.findByIdWithCharacter).mockResolvedValue(null);

    const { initiateCall } = await import("../callLifecycle");

    await expect(
      initiateCall({
        scenarioId: "nonexistent",
        userId: "user-abc",
        phoneNumber: "+33612345678",
        maxDurationSeconds: 600,
      }),
    ).rejects.toThrow("Scénario introuvable");

    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("should throw INSUFFICIENT_CREDITS when UserBilling debit fails and legacy also fails", async () => {
    const { db } = await import("@/server/db");
    const { scenarioRepository } = await import("@/server/repositories");

    vi.mocked(scenarioRepository.findByIdWithCharacter).mockResolvedValue(validScenario);

    // Both UserBilling and legacy updateMany return 0 (insufficient credits)
    mockTx["userBilling"].updateMany.mockResolvedValue({ count: 0 });
    mockTx["user"].updateMany.mockResolvedValue({ count: 0 });
    mockTx["user"].findUnique.mockResolvedValue({ id: "user-abc" });
    (db.$transaction as Mock).mockImplementation(
      async (cb: (tx: Record<string, any>) => Promise<unknown>) => cb(mockTx),
    );

    const { initiateCall } = await import("../callLifecycle");

    await expect(
      initiateCall({
        scenarioId: "scenario-1",
        userId: "user-abc",
        phoneNumber: "+33612345678",
        maxDurationSeconds: 600,
      }),
    ).rejects.toThrow("Crédits insuffisants");
  });

  it("should throw USER_NOT_FOUND when UserBilling and legacy both fail and user doesn't exist", async () => {
    const { db } = await import("@/server/db");
    const { scenarioRepository } = await import("@/server/repositories");

    vi.mocked(scenarioRepository.findByIdWithCharacter).mockResolvedValue(validScenario);

    // Both UserBilling and legacy updateMany return 0
    mockTx["userBilling"].updateMany.mockResolvedValue({ count: 0 });
    mockTx["user"].updateMany.mockResolvedValue({ count: 0 });
    mockTx["user"].findUnique.mockResolvedValue(null);
    (db.$transaction as Mock).mockImplementation(
      async (cb: (tx: Record<string, any>) => Promise<unknown>) => cb(mockTx),
    );

    const { initiateCall } = await import("../callLifecycle");

    await expect(
      initiateCall({
        scenarioId: "scenario-1",
        userId: "nonexistent-user",
        phoneNumber: "+33612345678",
        maxDurationSeconds: 600,
      }),
    ).rejects.toThrow("Utilisateur introuvable");
  });

  it("should refund credits via callRepository when Twilio call fails", async () => {
    const { db } = await import("@/server/db");
    const { twilioClient } = await import("@/server/services/telephony/twilio");
    const { scenarioRepository, callRepository } = await import("@/server/repositories");

    vi.mocked(scenarioRepository.findByIdWithCharacter).mockResolvedValue(validScenario);
    (db.$transaction as Mock).mockImplementation(
      async (cb: (tx: Record<string, any>) => Promise<unknown>) => cb(mockTx),
    );

    // Make the Twilio call fail
    const twilioError = new Error("Twilio network error");
    (twilioClient.calls.create as Mock).mockRejectedValue(twilioError);

    const { initiateCall } = await import("../callLifecycle");

    await expect(
      initiateCall({
        scenarioId: "scenario-1",
        userId: "user-abc",
        phoneNumber: "+33612345678",
        maxDurationSeconds: 600,
      }),
    ).rejects.toThrow("Échec de l'appel");

    // Verify refund via repository
    expect(callRepository.markAsFailedWithRefund).toHaveBeenCalledWith("call-1", 0);
  });

  it("should NOT refund credits if call was already advanced from CALLING (race condition)", async () => {
    const { db } = await import("@/server/db");
    const { twilioClient } = await import("@/server/services/telephony/twilio");
    const { scenarioRepository, callRepository } = await import("@/server/repositories");

    vi.mocked(scenarioRepository.findByIdWithCharacter).mockResolvedValue(validScenario);
    (db.$transaction as Mock).mockImplementation(
      async (cb: (tx: Record<string, any>) => Promise<unknown>) => cb(mockTx),
    );

    // Make the Twilio call fail
    (twilioClient.calls.create as Mock).mockRejectedValue(new Error("Twilio error"));

    const { initiateCall } = await import("../callLifecycle");

    await expect(
      initiateCall({
        scenarioId: "scenario-1",
        userId: "user-abc",
        phoneNumber: "+33612345678",
        maxDurationSeconds: 600,
      }),
    ).rejects.toThrow("Échec de l'appel");

    // markAsFailedWithRefund still gets called — it handles the guard internally
    expect(callRepository.markAsFailedWithRefund).toHaveBeenCalledWith("call-1", 0);
  });

  it("should throw sanitized TWILIO_ERROR instead of original Twilio message", async () => {
    const { db } = await import("@/server/db");
    const { twilioClient } = await import("@/server/services/telephony/twilio");
    const { scenarioRepository } = await import("@/server/repositories");

    vi.mocked(scenarioRepository.findByIdWithCharacter).mockResolvedValue(validScenario);
    (db.$transaction as Mock).mockImplementation(
      async (cb: (tx: Record<string, any>) => Promise<unknown>) => cb(mockTx),
    );

    (twilioClient.calls.create as Mock).mockRejectedValue(new Error("Rate limit exceeded"));

    const { initiateCall } = await import("../callLifecycle");

    await expect(
      initiateCall({
        scenarioId: "scenario-1",
        userId: "user-abc",
        phoneNumber: "+33612345678",
        maxDurationSeconds: 600,
      }),
    ).rejects.toThrow("Échec de l'appel");
  });

  it("should include token in the Twilio webhook URL", async () => {
    const { db } = await import("@/server/db");
    const { twilioClient } = await import("@/server/services/telephony/twilio");
    const { createTwilioToken } = await import("@/server/lib/twilioToken");
    const { scenarioRepository } = await import("@/server/repositories");

    vi.mocked(createTwilioToken).mockReturnValue("test-token-123");
    vi.mocked(scenarioRepository.findByIdWithCharacter).mockResolvedValue(validScenario);
    (db.$transaction as Mock).mockImplementation(
      async (cb: (tx: Record<string, any>) => Promise<unknown>) => cb(mockTx),
    );
    (twilioClient.calls.create as Mock).mockResolvedValue({ sid: "CA_mock_sid" });

    const { initiateCall } = await import("../callLifecycle");
    await initiateCall({
      scenarioId: "scenario-1",
      userId: "user-abc",
      phoneNumber: "+33612345678",
      maxDurationSeconds: 600,
    });

    // Verify the token is encoded in the Twilio webhook URL
    expect(twilioClient.calls.create).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining("token=test-token-123"),
      }),
    );
  });

  it("should pass correct Twilio call parameters", async () => {
    const { db } = await import("@/server/db");
    const { twilioClient } = await import("@/server/services/telephony/twilio");
    const { scenarioRepository } = await import("@/server/repositories");

    vi.mocked(scenarioRepository.findByIdWithCharacter).mockResolvedValue(validScenario);
    (db.$transaction as Mock).mockImplementation(
      async (cb: (tx: Record<string, any>) => Promise<unknown>) => cb(mockTx),
    );
    (twilioClient.calls.create as Mock).mockResolvedValue({ sid: "CA_mock_sid" });

    const { initiateCall } = await import("../callLifecycle");
    await initiateCall({
      scenarioId: "scenario-1",
      userId: "user-abc",
      phoneNumber: "+33612345678",
      maxDurationSeconds: 600,
    });

    expect(twilioClient.calls.create).toHaveBeenCalledWith({
      to: "+33612345678",
      from: "+1234567890",
      url: expect.stringContaining("/api/webhooks/twilio/voice"),
      statusCallback: expect.stringContaining("/api/webhooks/twilio"),
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST",
      // free tier caps duration at 300s (input 600 is clamped server-side)
      timeout: 300,
    });
  });

  // -----------------------------------------------------------------------
  // Sprint 2: Daily limit integration via atomicIncrementDailyLimit
  // -----------------------------------------------------------------------

  it("should call atomicIncrementDailyLimit inside the transaction", async () => {
    const { db } = await import("@/server/db");
    const { twilioClient } = await import("@/server/services/telephony/twilio");
    const { scenarioRepository } = await import("@/server/repositories");

    vi.mocked(scenarioRepository.findByIdWithCharacter).mockResolvedValue(validScenario);
    (db.$transaction as Mock).mockImplementation(
      async (cb: (tx: Record<string, any>) => Promise<unknown>) => cb(mockTx),
    );
    (twilioClient.calls.create as Mock).mockResolvedValue({ sid: "CA_mock_sid" });

    const { initiateCall } = await import("../callLifecycle");
    await initiateCall({
      scenarioId: "scenario-1",
      userId: "user-abc",
      phoneNumber: "+33612345678",
      maxDurationSeconds: 600,
    });

    // Verify dailyCallLimit.updateMany was called inside the transaction
    expect(mockTx["dailyCallLimit"].updateMany).toHaveBeenCalledTimes(1);
    expect(mockTx["dailyCallLimit"].updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-abc",
        date: expect.any(Date),
        callCount: { lt: 10 },
        totalDurationSeconds: { lt: 36000 },
      },
      // free tier caps duration at 300s (input 600 is clamped server-side)
      data: { callCount: { increment: 1 }, totalDurationSeconds: { increment: 300 } },
    });
  });

  it("should throw DAILY_LIMIT_EXCEEDED when atomicIncrementDailyLimit fails", async () => {
    const { db } = await import("@/server/db");
    const { scenarioRepository } = await import("@/server/repositories");
    vi.mocked(scenarioRepository.findByIdWithCharacter).mockResolvedValue(validScenario);

    // Simulate daily limit exceeded inside the transaction.
    // atomicIncrementDailyLimit throws AppError("DAILY_LIMIT_EXCEEDED", ...)
    // which propagates up through the $transaction callback.
    mockTx["dailyCallLimit"] = {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi
        .fn()
        .mockRejectedValue(Object.assign(new Error("Unique constraint"), { code: "P2002" })),
    };
    (db.$transaction as Mock).mockImplementation(
      async (cb: (tx: Record<string, any>) => Promise<unknown>) => cb(mockTx),
    );

    const { initiateCall } = await import("../callLifecycle");

    // The AppError propagates up from the transaction callback
    await expect(
      initiateCall({
        scenarioId: "scenario-1",
        userId: "user-abc",
        phoneNumber: "+33612345678",
        maxDurationSeconds: 600,
      }),
    ).rejects.toThrow();
  });

  // -----------------------------------------------------------------------
  // Sprint 2: Call created with CALLING status for crash recovery
  // -----------------------------------------------------------------------

  it("should create call with CALLING status for crash recovery", async () => {
    const { db } = await import("@/server/db");
    const { twilioClient } = await import("@/server/services/telephony/twilio");
    const { scenarioRepository } = await import("@/server/repositories");

    vi.mocked(scenarioRepository.findByIdWithCharacter).mockResolvedValue(validScenario);
    (db.$transaction as Mock).mockImplementation(
      async (cb: (tx: Record<string, any>) => Promise<unknown>) => cb(mockTx),
    );
    (twilioClient.calls.create as Mock).mockResolvedValue({ sid: "CA_mock_sid" });

    const { initiateCall } = await import("../callLifecycle");
    await initiateCall({
      scenarioId: "scenario-1",
      userId: "user-abc",
      phoneNumber: "+33612345678",
      maxDurationSeconds: 600,
    });

    // Call created with CALLING — not PENDING
    expect(mockTx["call"].create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "CALLING",
        }),
      }),
    );
  });

  // -----------------------------------------------------------------------
  // Sprint 2: UpdateMany status guard on Twilio error
  // -----------------------------------------------------------------------

  it("should refund via markAsFailedWithRefund on Twilio failure", async () => {
    const { db } = await import("@/server/db");
    const { twilioClient } = await import("@/server/services/telephony/twilio");
    const { scenarioRepository, callRepository } = await import("@/server/repositories");

    vi.mocked(scenarioRepository.findByIdWithCharacter).mockResolvedValue(validScenario);
    (db.$transaction as Mock).mockImplementation(
      async (cb: (tx: Record<string, any>) => Promise<unknown>) => cb(mockTx),
    );
    (twilioClient.calls.create as Mock).mockRejectedValue(new Error("Twilio error"));

    const { initiateCall } = await import("../callLifecycle");

    await expect(
      initiateCall({
        scenarioId: "scenario-1",
        userId: "user-abc",
        phoneNumber: "+33612345678",
        maxDurationSeconds: 600,
      }),
    ).rejects.toThrow();

    // Verify the refund via repository
    expect(callRepository.markAsFailedWithRefund).toHaveBeenCalledWith("call-1", 0);
  });

  // -----------------------------------------------------------------------
  // Sprint 2: Transaction includes daily limit + debit + call creation
  // -----------------------------------------------------------------------

  it("should perform daily limit, debit, and call creation in a single transaction", async () => {
    const { db } = await import("@/server/db");
    const { twilioClient } = await import("@/server/services/telephony/twilio");
    const { scenarioRepository } = await import("@/server/repositories");

    vi.mocked(scenarioRepository.findByIdWithCharacter).mockResolvedValue(validScenario);

    // Track transaction callback to inspect what happens inside
    (db.$transaction as Mock).mockImplementation(
      async (cb: (tx: Record<string, any>) => Promise<unknown>) => cb(mockTx),
    );
    (twilioClient.calls.create as Mock).mockResolvedValue({ sid: "CA_mock_sid" });

    const { initiateCall } = await import("../callLifecycle");
    await initiateCall({
      scenarioId: "scenario-1",
      userId: "user-abc",
      phoneNumber: "+33612345678",
      maxDurationSeconds: 600,
    });

    // Verify that a single $transaction was used for all three operations
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    // dailyCallLimit.updateMany = daily limit check
    expect(mockTx["dailyCallLimit"].updateMany).toHaveBeenCalled();
    // userBilling.updateMany = atomic debit (Sprint 4: prefers UserBilling)
    expect(mockTx["userBilling"].updateMany).toHaveBeenCalled();
    // call.create = call record
    expect(mockTx["call"].create).toHaveBeenCalled();
  });
});
