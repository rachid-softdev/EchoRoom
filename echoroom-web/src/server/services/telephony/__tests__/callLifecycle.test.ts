import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Call Lifecycle tests: failCall idempotency
// ---------------------------------------------------------------------------
// failCall uses callback-based $transaction to atomically:
//   1. Check call status (guard: skip if already FAILED or COMPLETED)
//   2. Refund credits to user
//   3. Update call status to FAILED

vi.mock("@/server/db", () => ({
  db: {
    $transaction: vi.fn(),
  },
}));

vi.mock("@/server/services/telephony/twilio", () => ({
  twilioClient: {},
  TWILIO_PHONE: "+1234567890",
}));

vi.mock("@/lib/env", () => ({
  env: {},
}));

describe("failCall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should refund credits and mark call as FAILED", async () => {
    const { db } = await import("@/server/db");
    const mockTx = {
      call: {
        findUnique: vi.fn().mockResolvedValue({
          id: "call-1",
          userId: "user-1",
          costCredits: 1,
          status: "ACTIVE",
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

    // Should check current call status inside transaction
    expect(mockTx.call.findUnique).toHaveBeenCalledWith({
      where: { id: "call-1" },
      select: { userId: true, costCredits: true, status: true },
    });

    // Should refund the costCredits
    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { credits: { increment: 1 } },
    });

    // Should mark call as FAILED
    expect(mockTx.call.update).toHaveBeenCalledWith({
      where: { id: "call-1" },
      data: expect.objectContaining({
        status: "FAILED",
        durationSeconds: 30,
      }),
    });
  });

  it("should be idempotent: second call should not refund again", async () => {
    const { db } = await import("@/server/db");
    const mockTxFindUnique = vi.fn();

    // First call: status is ACTIVE, should process
    // Second call: status is FAILED, should skip
    mockTxFindUnique
      .mockResolvedValueOnce({
        id: "call-1",
        userId: "user-1",
        costCredits: 1,
        status: "ACTIVE",
      })
      .mockResolvedValueOnce({
        id: "call-1",
        userId: "user-1",
        costCredits: 1,
        status: "FAILED",
      });

    const mockTxUpdateUser = vi.fn();
    const mockTxUpdateCall = vi.fn();

    const mockTx = {
      call: {
        findUnique: mockTxFindUnique,
        update: mockTxUpdateCall,
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
    expect(mockTxUpdateCall).toHaveBeenCalledTimes(1);

    // Second call — should be idempotent (skip)
    await failCall("call-1", 60);
    expect(mockTxUpdateUser).toHaveBeenCalledTimes(1); // Still 1 — no additional refund
    expect(mockTxUpdateCall).toHaveBeenCalledTimes(1); // Still 1 — no additional update
  });

  it("should skip already completed calls", async () => {
    const { db } = await import("@/server/db");
    const mockTx = {
      call: {
        findUnique: vi.fn().mockResolvedValue({
          id: "call-1",
          userId: "user-1",
          costCredits: 1,
          status: "COMPLETED",
        }),
        update: vi.fn(),
      },
      user: {
        update: vi.fn(),
      },
    };

    (db.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    const { failCall } = await import("../callLifecycle");
    await failCall("call-1");

    // Should not modify anything
    expect(mockTx.user.update).not.toHaveBeenCalled();
    expect(mockTx.call.update).not.toHaveBeenCalled();
  });

  it("should skip non-existent calls", async () => {
    const { db } = await import("@/server/db");
    const mockTx = {
      call: {
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
      user: {
        update: vi.fn(),
      },
    };

    (db.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    const { failCall } = await import("../callLifecycle");
    await failCall("nonexistent-call");

    // Should not modify anything
    expect(mockTx.user.update).not.toHaveBeenCalled();
    expect(mockTx.call.update).not.toHaveBeenCalled();
  });

  it("should handle zero duration gracefully", async () => {
    const { db } = await import("@/server/db");
    const mockTx = {
      call: {
        findUnique: vi.fn().mockResolvedValue({
          id: "call-1",
          userId: "user-1",
          costCredits: 2,
          status: "ACTIVE",
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      user: {
        update: vi.fn().mockResolvedValue({}),
      },
    };

    (db.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    const { failCall } = await import("../callLifecycle");
    await failCall("call-1"); // No duration provided

    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { credits: { increment: 2 } },
    });
    expect(mockTx.call.update).toHaveBeenCalledWith({
      where: { id: "call-1" },
      data: expect.objectContaining({
        status: "FAILED",
        durationSeconds: 0,
      }),
    });
  });

  it("should preserve call cost credits when refunding", async () => {
    const { db } = await import("@/server/db");
    const mockTx = {
      call: {
        findUnique: vi.fn().mockResolvedValue({
          id: "call-expensive",
          userId: "user-premium",
          costCredits: 10,
          status: "ACTIVE",
        }),
        update: vi.fn().mockResolvedValue({}),
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
