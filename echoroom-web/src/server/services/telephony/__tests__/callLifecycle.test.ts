import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Call Lifecycle tests: failCall idempotency, initiateCall, withRetry
// ---------------------------------------------------------------------------
// failCall uses callback-based $transaction to atomically:
//   1. Call updateMany with status guard (WHERE status NOT IN FAILED, COMPLETED)
//   2. If updateMany count > 0: fetch call data, refund credits
//   3. If updateMany count = 0: skip (already finalised)
// Uses updateMany instead of read-then-check to prevent TOCTOU race conditions.
//
// initiateCall orchestrates:
//   1. Scenario lookup
//   2. Atomic debit + call record creation in a $transaction
//   3. Twilio call initiation
//   4. Refund + failure marking on Twilio error
//
// withRetry provides exponential backoff with jitter.

vi.mock("@/server/db", () => ({
  db: {
    $transaction: vi.fn(),
    scenario: { findUnique: vi.fn() },
    call: { update: vi.fn() },
  },
}));

vi.mock("@/server/services/telephony/twilio", () => ({
  twilioClient: {
    calls: { create: vi.fn() },
  },
  TWILIO_PHONE: "+1234567890",
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

describe("failCall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should refund credits and mark call as FAILED", async () => {
    const { db } = await import("@/server/db");
    const mockTx = {
      call: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: "call-1",
          userId: "user-1",
          costCredits: 1,
          status: "FAILED",
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      user: {
        update: vi.fn().mockResolvedValue({}),
      },
    };

    (db.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    const { failCall } = await import("../callLifecycle");
    await failCall("call-1", 30);

    // Should update call status with guard against already-failed/completed
    expect(mockTx.call.updateMany).toHaveBeenCalledWith({
      where: { id: "call-1", status: { notIn: ["FAILED", "COMPLETED"] } },
      data: expect.objectContaining({
        status: "FAILED",
        durationSeconds: 30,
      }),
    });

    // Should fetch userId and costCredits after successful update
    expect(mockTx.call.findUnique).toHaveBeenCalledWith({
      where: { id: "call-1" },
      select: { userId: true, costCredits: true },
    });

    // Should refund the costCredits
    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { credits: { increment: 1 } },
    });
  });

  it("should be idempotent: second call should not refund again", async () => {
    const { db } = await import("@/server/db");
    const mockTxUpdateMany = vi.fn();
    const mockTxFindUnique = vi.fn();

    // First call: updateMany succeeds (count=1)
    // Second call: updateMany returns 0 (already FAILED)
    mockTxUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    // Only the first call should proceed to findUnique
    mockTxFindUnique.mockResolvedValueOnce({
      id: "call-1",
      userId: "user-1",
      costCredits: 1,
    });

    const mockTxUpdateUser = vi.fn();

    const mockTx = {
      call: {
        updateMany: mockTxUpdateMany,
        findUnique: mockTxFindUnique,
        update: vi.fn(),
      },
      user: {
        update: mockTxUpdateUser,
      },
    };

    (db.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    const { failCall } = await import("../callLifecycle");

    // First call — should process
    await failCall("call-1", 30);
    expect(mockTxUpdateUser).toHaveBeenCalledTimes(1);

    // Second call — should be idempotent (skip refund because updateMany returned 0)
    await failCall("call-1", 60);
    expect(mockTxUpdateUser).toHaveBeenCalledTimes(1); // Still 1 — no additional refund
  });

  it("should skip already completed calls", async () => {
    const { db } = await import("@/server/db");
    const mockTx = {
      call: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }), // 0 affected — already finalised
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      user: {
        update: vi.fn(),
      },
    };

    (db.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    const { failCall } = await import("../callLifecycle");
    await failCall("call-1");

    // Should not modify anything after updateMany returns 0
    expect(mockTx.user.update).not.toHaveBeenCalled();
    expect(mockTx.call.findUnique).not.toHaveBeenCalled();
  });

  it("should skip non-existent calls", async () => {
    const { db } = await import("@/server/db");
    const mockTx = {
      call: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }), // 0 affected — no matching row
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      user: {
        update: vi.fn(),
      },
    };

    (db.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    const { failCall } = await import("../callLifecycle");
    await failCall("nonexistent-call");

    // Should not modify anything after updateMany returns 0
    expect(mockTx.user.update).not.toHaveBeenCalled();
    expect(mockTx.call.findUnique).not.toHaveBeenCalled();
  });

  it("should handle zero duration gracefully", async () => {
    const { db } = await import("@/server/db");
    const mockTx = {
      call: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: "call-1",
          userId: "user-1",
          costCredits: 2,
        }),
        update: vi.fn(),
      },
      user: {
        update: vi.fn().mockResolvedValue({}),
      },
    };

    (db.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    const { failCall } = await import("../callLifecycle");
    await failCall("call-1"); // No duration provided

    // updateMany should have durationSeconds=0 as default
    expect(mockTx.call.updateMany).toHaveBeenCalledWith({
      where: { id: "call-1", status: { notIn: ["FAILED", "COMPLETED"] } },
      data: expect.objectContaining({
        status: "FAILED",
        durationSeconds: 0,
      }),
    });

    // Should refund 2 credits
    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { credits: { increment: 2 } },
    });
  });

  it("should preserve call cost credits when refunding", async () => {
    const { db } = await import("@/server/db");
    const mockTx = {
      call: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: "call-expensive",
          userId: "user-premium",
          costCredits: 10,
        }),
        update: vi.fn(),
      },
      user: {
        update: vi.fn().mockResolvedValue({}),
      },
    };

    (db.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    const { failCall } = await import("../callLifecycle");
    await failCall("call-expensive", 120);

    // Should refund all 10 credits (not a flat 1)
    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: "user-premium" },
      data: { credits: { increment: 10 } },
    });
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

  const validScenario = {
    id: "scenario-1",
    title: "Test Scenario",
    characterId: "char-1",
    character: {
      name: "TestBot",
      description: "A test character",
      promptSystem: "Be helpful",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default transaction mock — happy path: sufficient credits
    mockTx = {
      user: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
      call: {
        create: vi.fn().mockResolvedValue({ id: "call-1" }),
        update: vi.fn(),
        updateMany: vi.fn(),
        findUnique: vi.fn(),
      },
    };
  });

  it("should successfully initiate a call and return callId with estimatedCredits", async () => {
    const { db } = await import("@/server/db");
    const { twilioClient } = await import("@/server/services/telephony/twilio");

    (db.scenario.findUnique as any).mockResolvedValue(validScenario);
    (db.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));
    (twilioClient.calls.create as any).mockResolvedValue({ sid: "CA_mock_sid_123" });

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

    (db.scenario.findUnique as any).mockResolvedValue(validScenario);
    (db.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));
    (twilioClient.calls.create as any).mockResolvedValue({ sid: "CA_mock_sid" });

    const { initiateCall } = await import("../callLifecycle");
    await initiateCall({
      scenarioId: "scenario-1",
      userId: "user-abc",
      phoneNumber: "+33612345678",
      maxDurationSeconds: 600,
    });

    expect(mockTx.call.create).toHaveBeenCalledWith({
      data: {
        userId: "user-abc",
        scenarioId: "scenario-1",
        phoneNumber: "encrypted:+33612345678",
        status: "PENDING",
        costCredits: 1,
      },
    });
    expect(encryptPhoneNumber).toHaveBeenCalledWith("+33612345678");
  });

  it("should debit 1 credit via atomicDebit inside the transaction", async () => {
    const { db } = await import("@/server/db");
    const { twilioClient } = await import("@/server/services/telephony/twilio");

    (db.scenario.findUnique as any).mockResolvedValue(validScenario);
    (db.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));
    (twilioClient.calls.create as any).mockResolvedValue({ sid: "CA_mock_sid" });

    const { initiateCall } = await import("../callLifecycle");
    await initiateCall({
      scenarioId: "scenario-1",
      userId: "user-abc",
      phoneNumber: "+33612345678",
      maxDurationSeconds: 600,
    });

    // atomicDebit internally calls tx.user.updateMany with credits gte condition
    expect(mockTx.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-abc", credits: { gte: 1 } },
      data: { credits: { decrement: 1 } },
    });
  });

  it("should create Twilio token with correct parameters", async () => {
    const { db } = await import("@/server/db");
    const { twilioClient } = await import("@/server/services/telephony/twilio");
    const { createTwilioToken } = await import("@/server/lib/twilioToken");

    (db.scenario.findUnique as any).mockResolvedValue(validScenario);
    (db.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));
    (twilioClient.calls.create as any).mockResolvedValue({ sid: "CA_mock_sid" });

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

    (db.scenario.findUnique as any).mockResolvedValue(validScenario);
    (db.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));
    (twilioClient.calls.create as any).mockResolvedValue({ sid: "CA_mock_ringing" });

    const { initiateCall } = await import("../callLifecycle");
    await initiateCall({
      scenarioId: "scenario-1",
      userId: "user-abc",
      phoneNumber: "+33612345678",
      maxDurationSeconds: 600,
    });

    expect(db.call.update).toHaveBeenCalledWith({
      where: { id: "call-1" },
      data: { status: "RINGING", twilioCallSid: "CA_mock_ringing" },
    });
  });

  it("should throw SCENARIO_NOT_FOUND when scenario does not exist", async () => {
    const { db } = await import("@/server/db");

    (db.scenario.findUnique as any).mockResolvedValue(null);

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

  it("should throw INSUFFICIENT_CREDITS when atomicDebit returns insufficient credits", async () => {
    const { db } = await import("@/server/db");

    (db.scenario.findUnique as any).mockResolvedValue(validScenario);

    // Transaction mock where updateMany returns 0 (insufficient credits) and user exists
    mockTx.user.updateMany.mockResolvedValue({ count: 0 });
    mockTx.user.findUnique.mockResolvedValue({ id: "user-abc" });
    (db.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

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

  it("should throw USER_NOT_FOUND when atomicDebit returns user not found", async () => {
    const { db } = await import("@/server/db");

    (db.scenario.findUnique as any).mockResolvedValue(validScenario);

    // Transaction mock where updateMany returns 0 and user doesn't exist
    mockTx.user.updateMany.mockResolvedValue({ count: 0 });
    mockTx.user.findUnique.mockResolvedValue(null);
    (db.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

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

  it("should refund credits and mark call as FAILED when Twilio call fails", async () => {
    const { db } = await import("@/server/db");
    const { twilioClient } = await import("@/server/services/telephony/twilio");

    (db.scenario.findUnique as any).mockResolvedValue(validScenario);
    (db.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    // Make the Twilio call fail
    const twilioError = new Error("Twilio network error");
    (twilioClient.calls.create as any).mockRejectedValue(twilioError);

    // Mock the refund transaction — it uses a separate $transaction call
    const refundTx = {
      user: { update: vi.fn().mockResolvedValue({}) },
      call: { update: vi.fn().mockResolvedValue({}) },
    };
    // The second call to $transaction is for the refund
    (db.$transaction as any)
      .mockResolvedValueOnce({ call: { id: "call-1" } }) // First call returns from the outer await
      .mockImplementationOnce(async (cb: any) => cb(refundTx)); // Second call is the refund transaction

    const { initiateCall } = await import("../callLifecycle");

    await expect(
      initiateCall({
        scenarioId: "scenario-1",
        userId: "user-abc",
        phoneNumber: "+33612345678",
        maxDurationSeconds: 600,
      }),
    ).rejects.toThrow("Échec de l'appel");

    // Verify the refund was processed
    expect(refundTx.user.update).toHaveBeenCalledWith({
      where: { id: "user-abc" },
      data: { credits: { increment: 1 } },
    });

    expect(refundTx.call.update).toHaveBeenCalledWith({
      where: { id: "call-1" },
      data: { status: "FAILED" },
    });
  });

  it("should throw TWILIO_ERROR with original error message", async () => {
    const { db } = await import("@/server/db");
    const { twilioClient } = await import("@/server/services/telephony/twilio");

    (db.scenario.findUnique as any).mockResolvedValue(validScenario);
    (db.$transaction as any)
      .mockResolvedValueOnce({ call: { id: "call-1" } })
      .mockImplementationOnce(async (cb: any) => cb({
        user: { update: vi.fn().mockResolvedValue({}) },
        call: { update: vi.fn().mockResolvedValue({}) },
      }));

    (twilioClient.calls.create as any).mockRejectedValue(new Error("Rate limit exceeded"));

    const { initiateCall } = await import("../callLifecycle");

    await expect(
      initiateCall({
        scenarioId: "scenario-1",
        userId: "user-abc",
        phoneNumber: "+33612345678",
        maxDurationSeconds: 600,
      }),
    ).rejects.toThrow("Rate limit exceeded");
  });

  it("should include token in the Twilio webhook URL", async () => {
    const { db } = await import("@/server/db");
    const { twilioClient } = await import("@/server/services/telephony/twilio");
    const { createTwilioToken } = await import("@/server/lib/twilioToken");

    (createTwilioToken as any).mockReturnValue("test-token-123");
    (db.scenario.findUnique as any).mockResolvedValue(validScenario);
    (db.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));
    (twilioClient.calls.create as any).mockResolvedValue({ sid: "CA_mock_sid" });

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

    (db.scenario.findUnique as any).mockResolvedValue(validScenario);
    (db.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));
    (twilioClient.calls.create as any).mockResolvedValue({ sid: "CA_mock_sid" });

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
      timeout: 600,
    });
  });
});
