import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Call Lifecycle tests: failCall idempotency
// ---------------------------------------------------------------------------
// failCall uses callback-based $transaction to atomically:
//   1. Call updateMany with status guard (WHERE status NOT IN FAILED, COMPLETED)
//   2. If updateMany count > 0: fetch call data, refund credits
//   3. If updateMany count = 0: skip (already finalised)
// Uses updateMany instead of read-then-check to prevent TOCTOU race conditions.

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
