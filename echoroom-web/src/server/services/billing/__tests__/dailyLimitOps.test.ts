import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/server/lib/errors";

// ---------------------------------------------------------------------------
// atomicIncrementDailyLimit — Atomic daily limit for calls
// ---------------------------------------------------------------------------
// This function:
//   1. Tries updateMany with WHERE callCount < maxLimit to atomically increment
//   2. If count=0: tries to create a new row (no record yet)
//   3. If create throws P2002: retries updateMany (another tx created the row)
//   4. If retry also returns 0: throws DAILY_LIMIT_EXCEEDED
//
// Must be called inside a Prisma $transaction callback.

describe("atomicIncrementDailyLimit", () => {
  let mockUpdateMany: ReturnType<typeof vi.fn>;
  let mockCreate: ReturnType<typeof vi.fn>;
  const userId = "user-abc";
  const date = new Date("2026-05-31T00:00:00.000Z");
  const maxLimit = 10;

  function buildTx() {
    return {
      dailyCallLimit: {
        updateMany: mockUpdateMany,
        create: mockCreate,
      },
    } as unknown as Parameters<typeof import("../dailyLimitOps").atomicIncrementDailyLimit>[0];
  }

  beforeEach(() => {
    vi.resetAllMocks();
    mockUpdateMany = vi.fn();
    mockCreate = vi.fn();
  });

  // -----------------------------------------------------------------------
  // Happy path — first call creates a new row
  // -----------------------------------------------------------------------

  it("should create a new row with callCount=1 on first call (no existing row)", async () => {
    // updateMany returns 0 — no existing row for this user+date
    mockUpdateMany.mockResolvedValue({ count: 0 });
    // create succeeds
    mockCreate.mockResolvedValue({ id: "dcl-1" });

    const { atomicIncrementDailyLimit } = await import("../dailyLimitOps");
    await atomicIncrementDailyLimit(buildTx(), { userId, date, maxLimit });

    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { userId, date, callCount: { lt: maxLimit } },
      data: { callCount: { increment: 1 }, totalDurationSeconds: { increment: 0 } },
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
      data: { userId, date, callCount: 1, totalDurationSeconds: 0 },
    });
  });

  // -----------------------------------------------------------------------
  // Subsequent calls increment until maxLimit
  // -----------------------------------------------------------------------

  it("should increment callCount when row exists and under limit", async () => {
    // Row exists and is under limit
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const { atomicIncrementDailyLimit } = await import("../dailyLimitOps");
    await atomicIncrementDailyLimit(buildTx(), { userId, date, maxLimit });

    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { userId, date, callCount: { lt: maxLimit } },
      data: { callCount: { increment: 1 }, totalDurationSeconds: { increment: 0 } },
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("should increment from 1 to maxLimit across multiple calls", async () => {
    // Row exists for all calls
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const { atomicIncrementDailyLimit } = await import("../dailyLimitOps");
    const tx = buildTx();

    for (let i = 0; i < 10; i++) {
      await atomicIncrementDailyLimit(tx, { userId, date, maxLimit });
    }

    // updateMany called 10 times, each time with increment
    expect(mockUpdateMany).toHaveBeenCalledTimes(10);
    // create never called (row already exists)
    expect(mockCreate).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Exceeding maxLimit
  // -----------------------------------------------------------------------

  it("should throw DAILY_LIMIT_EXCEEDED when row exists at maxLimit", async () => {
    // Row exists but is at limit — updateMany returns 0 (lt: maxLimit fails)
    // create would throw P2002 (row exists), retry also returns 0
    mockUpdateMany.mockResolvedValue({ count: 0 });
    const p2002Error = Object.assign(new Error("Unique constraint"), {
      code: "P2002",
    });
    mockCreate.mockRejectedValue(p2002Error);

    const { atomicIncrementDailyLimit } = await import("../dailyLimitOps");

    try {
      await atomicIncrementDailyLimit(buildTx(), { userId, date, maxLimit });
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).message).toBe("Limite quotidienne de durée d'appels atteinte");
    }

    // updateMany called twice (first attempt + retry after P2002)
    expect(mockUpdateMany).toHaveBeenCalledTimes(2);
    // create called once (failed with P2002)
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("should throw DAILY_LIMIT_EXCEEDED with correct error code", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });
    const p2002Error = Object.assign(new Error("Unique constraint"), {
      code: "P2002",
    });
    mockCreate.mockRejectedValue(p2002Error);

    const { atomicIncrementDailyLimit } = await import("../dailyLimitOps");

    try {
      await atomicIncrementDailyLimit(buildTx(), { userId, date, maxLimit });
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("DAILY_LIMIT_EXCEEDED");
    }
  });

  // -----------------------------------------------------------------------
  // Concurrent unique constraint violation (P2002) — retry succeeds
  // -----------------------------------------------------------------------

  it("should handle P2002 race condition — retry succeeds on second attempt", async () => {
    // First updateMany: returns 0 (no row yet)
    // create: throws P2002 (another tx created the row first)
    // Retry updateMany: returns 1 (row now exists and is under limit)
    mockUpdateMany
      .mockResolvedValueOnce({ count: 0 }) // First attempt: no row
      .mockResolvedValueOnce({ count: 1 }); // Retry after P2002: success

    const p2002Error = Object.assign(new Error("Unique constraint"), {
      code: "P2002",
    });
    mockCreate.mockRejectedValue(p2002Error);

    const { atomicIncrementDailyLimit } = await import("../dailyLimitOps");
    await atomicIncrementDailyLimit(buildTx(), { userId, date, maxLimit });

    // updateMany called twice (initial + retry)
    expect(mockUpdateMany).toHaveBeenCalledTimes(2);
    // create called once (failed)
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("should handle P2002 race condition — retry also at limit", async () => {
    // First updateMany: returns 0 (no row yet)
    // create: throws P2002 (another tx created the row)
    // Retry updateMany: returns 0 (other tx already at maxLimit)
    mockUpdateMany
      .mockResolvedValueOnce({ count: 0 }) // First attempt: no row
      .mockResolvedValueOnce({ count: 0 }); // Retry after P2002: at limit

    const p2002Error = Object.assign(new Error("Unique constraint"), {
      code: "P2002",
    });
    mockCreate.mockRejectedValue(p2002Error);

    const { atomicIncrementDailyLimit } = await import("../dailyLimitOps");

    await expect(atomicIncrementDailyLimit(buildTx(), { userId, date, maxLimit })).rejects.toThrow(
      "Limite quotidienne de durée d'appels atteinte",
    );
  });

  // -----------------------------------------------------------------------
  // Non-P2002 errors from create are re-thrown
  // -----------------------------------------------------------------------

  it("should re-throw non-P2002 errors from create", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });
    const dbError = Object.assign(new Error("Connection refused"), {
      code: "ECONNREFUSED",
    });
    mockCreate.mockRejectedValue(dbError);

    const { atomicIncrementDailyLimit } = await import("../dailyLimitOps");

    await expect(atomicIncrementDailyLimit(buildTx(), { userId, date, maxLimit })).rejects.toThrow(
      "Connection refused",
    );
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it("should throw DAILY_LIMIT_EXCEEDED with maxLimit=0 when row already exists", async () => {
    // maxLimit=0: updateMany with lt:0 never matches once a row exists.
    // Simulate a row already existing from a previous call by having
    // create throw P2002, making the retry path the only option.
    mockUpdateMany.mockResolvedValue({ count: 0 });
    const p2002Error = Object.assign(new Error("Unique constraint"), {
      code: "P2002",
    });
    mockCreate.mockRejectedValue(p2002Error);

    const { atomicIncrementDailyLimit } = await import("../dailyLimitOps");

    await expect(
      atomicIncrementDailyLimit(buildTx(), { userId, date, maxLimit: 0 }),
    ).rejects.toThrow(AppError);
  });

  it("should work with maxLimit=1 (single daily call)", async () => {
    // First call: no row exists yet
    mockUpdateMany.mockResolvedValueOnce({ count: 0 });
    mockCreate.mockResolvedValue({ id: "dcl-1" });

    const { atomicIncrementDailyLimit } = await import("../dailyLimitOps");
    await atomicIncrementDailyLimit(buildTx(), { userId, date, maxLimit: 1 });

    expect(mockCreate).toHaveBeenCalledWith({
      data: { userId, date, callCount: 1, totalDurationSeconds: 0 },
    });
  });

  it("should reject when maxLimit is reached with maxLimit=1", async () => {
    // Row exists but already at limit=1 — updateMany returns 0
    mockUpdateMany.mockResolvedValue({ count: 0 });
    const p2002Error = Object.assign(new Error("Unique constraint"), {
      code: "P2002",
    });
    mockCreate.mockRejectedValue(p2002Error);

    const { atomicIncrementDailyLimit } = await import("../dailyLimitOps");

    await expect(
      atomicIncrementDailyLimit(buildTx(), { userId, date, maxLimit: 1 }),
    ).rejects.toThrow("Limite quotidienne de durée d'appels atteinte");
  });
});
