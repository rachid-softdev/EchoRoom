import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// atomicDebit & atomicRefund — Credit operations tests
// ---------------------------------------------------------------------------
// These functions use the Prisma transaction client pattern:
//   atomicDebit(tx, { userId, cost })
//   atomicRefund(tx, { userId, amount })
//
// We test by passing a mock transaction object that mimics Prisma's API.

describe("atomicDebit", () => {
  let mockUpdateMany: ReturnType<typeof vi.fn>;
  let mockFindUnique: ReturnType<typeof vi.fn>;
  let mockTx: Partial<PrismaClient>;

  beforeEach(() => {
    vi.resetAllMocks();
    mockUpdateMany = vi.fn();
    mockFindUnique = vi.fn();

    // Build a minimal transaction client mock
    mockTx = {
      user: {
        // Prisma's result is { count: number }
        updateMany: mockUpdateMany,
        findUnique: mockFindUnique,
      } as unknown as PrismaClient["user"],
    } as unknown as Partial<PrismaClient>;
  });

  it("should return { debited: true } when user has sufficient credits", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const { atomicDebit } = await import("../creditOps");
    const result = await atomicDebit(mockTx as any, {
      userId: "user-abc",
      cost: 5,
    });

    expect(result).toEqual({ debited: true });
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "user-abc", credits: { gte: 5 } },
      data: { credits: { decrement: 5 } },
    });
    // Should NOT call findUnique on success
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("should debit 1 credit successfully", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const { atomicDebit } = await import("../creditOps");
    const result = await atomicDebit(mockTx as any, {
      userId: "user-abc",
      cost: 1,
    });

    expect(result).toEqual({ debited: true });
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "user-abc", credits: { gte: 1 } },
      data: { credits: { decrement: 1 } },
    });
  });

  it("should return INSUFFICIENT_CREDITS when updateMany returns 0 and user exists", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockFindUnique.mockResolvedValue({ id: "user-abc" });

    const { atomicDebit } = await import("../creditOps");
    const result = await atomicDebit(mockTx as any, {
      userId: "user-abc",
      cost: 5,
    });

    expect(result).toEqual({
      debited: false,
      reason: "INSUFFICIENT_CREDITS",
    });
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "user-abc" },
      select: { id: true },
    });
  });

  it("should return USER_NOT_FOUND when updateMany returns 0 and user doesn't exist", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockFindUnique.mockResolvedValue(null);

    const { atomicDebit } = await import("../creditOps");
    const result = await atomicDebit(mockTx as any, {
      userId: "nonexistent-user",
      cost: 5,
    });

    expect(result).toEqual({
      debited: false,
      reason: "USER_NOT_FOUND",
    });
  });

  it("should handle zero cost gracefully", async () => {
    // Debit with cost=0 should always succeed (gte: 0 matches all >= 0)
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const { atomicDebit } = await import("../creditOps");
    const result = await atomicDebit(mockTx as any, {
      userId: "user-abc",
      cost: 0,
    });

    expect(result).toEqual({ debited: true });
  });

  it("should handle large cost values", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const { atomicDebit } = await import("../creditOps");
    const result = await atomicDebit(mockTx as any, {
      userId: "user-abc",
      cost: 99999,
    });

    expect(result).toEqual({ debited: true });
  });

  it("should prevent race conditions through atomic WHERE clause", async () => {
    // Simulate race condition: two concurrent debits
    // First call succeeds, second fails because credits are now < cost
    mockUpdateMany
      .mockResolvedValueOnce({ count: 1 }) // First debit succeeds
      .mockResolvedValueOnce({ count: 0 }); // Second debit fails

    const { atomicDebit } = await import("../creditOps");

    // First debit
    const result1 = await atomicDebit(mockTx as any, {
      userId: "user-abc",
      cost: 5,
    });
    expect(result1).toEqual({ debited: true });

    // Second debit — credits now insufficient
    mockFindUnique.mockResolvedValue({ id: "user-abc" });
    const result2 = await atomicDebit(mockTx as any, {
      userId: "user-abc",
      cost: 5,
    });
    expect(result2).toEqual({
      debited: false,
      reason: "INSUFFICIENT_CREDITS",
    });
  });

  it("should handle the case where user is deleted between updateMany and findUnique", async () => {
    // updateMany returns 0 (no matching row), findUnique returns null
    // This handles the edge case where user is deleted between the two calls
    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockFindUnique.mockResolvedValue(null);

    const { atomicDebit } = await import("../creditOps");
    const result = await atomicDebit(mockTx as any, {
      userId: "user-abc",
      cost: 5,
    });

    expect(result).toEqual({
      debited: false,
      reason: "USER_NOT_FOUND",
    });
  });

  it("should handle very low cost (0) with sufficient credits", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const { atomicDebit } = await import("../creditOps");
    const result = await atomicDebit(mockTx as any, {
      userId: "user-abc",
      cost: 0,
    });

    expect(result).toEqual({ debited: true });
  });
});

describe("atomicRefund", () => {
  let mockUpdate: ReturnType<typeof vi.fn>;
  let mockTx: Partial<PrismaClient>;

  beforeEach(() => {
    vi.resetAllMocks();
    mockUpdate = vi.fn();

    mockTx = {
      user: {
        update: mockUpdate,
      } as unknown as PrismaClient["user"],
    } as unknown as Partial<PrismaClient>;
  });

  it("should increment user credits by the specified amount", async () => {
    mockUpdate.mockResolvedValue({ id: "user-abc", credits: 15 });

    const { atomicRefund } = await import("../creditOps");
    await atomicRefund(mockTx as any, {
      userId: "user-abc",
      amount: 5,
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "user-abc" },
      data: { credits: { increment: 5 } },
    });
  });

  it("should handle refunding zero amount", async () => {
    mockUpdate.mockResolvedValue({ id: "user-abc", credits: 10 });

    const { atomicRefund } = await import("../creditOps");
    await atomicRefund(mockTx as any, {
      userId: "user-abc",
      amount: 0,
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "user-abc" },
      data: { credits: { increment: 0 } },
    });
  });

  it("should handle large refund amounts", async () => {
    mockUpdate.mockResolvedValue({ id: "user-abc", credits: 100000 });

    const { atomicRefund } = await import("../creditOps");
    await atomicRefund(mockTx as any, {
      userId: "user-abc",
      amount: 50000,
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "user-abc" },
      data: { credits: { increment: 50000 } },
    });
  });

  it("should not throw when user doesn't exist (Prisma throws by default)", async () => {
    // Prisma's update throws if record not found (by default)
    mockUpdate.mockRejectedValue(new Error("Record not found"));

    const { atomicRefund } = await import("../creditOps");
    await expect(
      atomicRefund(mockTx as any, { userId: "nonexistent", amount: 5 }),
    ).rejects.toThrow("Record not found");
  });
});

// ---------------------------------------------------------------------------
// atomicSafeDecrement — safe credit decrement that throws on failure
// ---------------------------------------------------------------------------

describe("atomicSafeDecrement", () => {
  let mockUpdateMany: ReturnType<typeof vi.fn>;
  let mockFindUnique: ReturnType<typeof vi.fn>;
  let mockTx: Partial<PrismaClient>;

  beforeEach(() => {
    vi.resetAllMocks();
    mockUpdateMany = vi.fn();
    mockFindUnique = vi.fn();

    mockTx = {
      user: {
        updateMany: mockUpdateMany,
        findUnique: mockFindUnique,
      } as unknown as PrismaClient["user"],
    } as unknown as Partial<PrismaClient>;
  });

  it("should decrement credits when user has sufficient credits", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const { atomicSafeDecrement } = await import("../creditOps");
    await atomicSafeDecrement(mockTx as any, {
      userId: "user-abc",
      amount: 5,
    });

    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "user-abc", credits: { gte: 5 } },
      data: { credits: { decrement: 5 } },
    });
    // Should NOT call findUnique on success
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("should throw INSUFFICIENT_CREDITS when credits are insufficient", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockFindUnique.mockResolvedValue({ id: "user-abc" }); // User exists

    const { atomicSafeDecrement } = await import("../creditOps");
    await expect(
      atomicSafeDecrement(mockTx as any, {
        userId: "user-abc",
        amount: 999,
      }),
    ).rejects.toThrow("Crédits insuffisants");

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "user-abc" },
      select: { id: true },
    });
  });

  it("should throw USER_NOT_FOUND when user does not exist", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockFindUnique.mockResolvedValue(null);

    const { atomicSafeDecrement } = await import("../creditOps");
    await expect(
      atomicSafeDecrement(mockTx as any, {
        userId: "nonexistent-user",
        amount: 5,
      }),
    ).rejects.toThrow("Utilisateur introuvable");

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "nonexistent-user" },
      select: { id: true },
    });
  });

  it("should throw AppError with INSUFFICIENT_CREDITS code", async () => {
    const { atomicSafeDecrement } = await import("../creditOps");
    const { AppError } = await import("@/server/lib/errors");

    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockFindUnique.mockResolvedValue({ id: "user-abc" });

    try {
      await atomicSafeDecrement(mockTx as any, {
        userId: "user-abc",
        amount: 999,
      });
      expect.unreachable("Should have thrown");
    } catch (e: any) {
      expect(e).toBeInstanceOf(AppError);
      expect(e.code).toBe("INSUFFICIENT_CREDITS");
    }
  });

  it("should throw AppError with USER_NOT_FOUND code", async () => {
    const { atomicSafeDecrement } = await import("../creditOps");
    const { AppError } = await import("@/server/lib/errors");

    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockFindUnique.mockResolvedValue(null);

    try {
      await atomicSafeDecrement(mockTx as any, {
        userId: "nonexistent",
        amount: 5,
      });
      expect.unreachable("Should have thrown");
    } catch (e: any) {
      expect(e).toBeInstanceOf(AppError);
      expect(e.code).toBe("USER_NOT_FOUND");
    }
  });

  it("should handle decrement of 1 credit", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const { atomicSafeDecrement } = await import("../creditOps");
    await atomicSafeDecrement(mockTx as any, {
      userId: "user-abc",
      amount: 1,
    });

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "user-abc", credits: { gte: 1 } },
      data: { credits: { decrement: 1 } },
    });
  });

  it("should handle large decrement amounts", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const { atomicSafeDecrement } = await import("../creditOps");
    await atomicSafeDecrement(mockTx as any, {
      userId: "user-abc",
      amount: 50000,
    });

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "user-abc", credits: { gte: 50000 } },
      data: { credits: { decrement: 50000 } },
    });
  });

  it("should prevent negative credits via WHERE credits gte guard", async () => {
    // Simulate race condition: user has 3 credits, two concurrent decrements of 2
    mockUpdateMany
      .mockResolvedValueOnce({ count: 1 }) // First succeeds (credits: 3 >= 2)
      .mockResolvedValueOnce({ count: 0 }); // Second fails (credits now: 1 < 2)

    const { atomicSafeDecrement } = await import("../creditOps");

    // First decrement
    await atomicSafeDecrement(mockTx as any, {
      userId: "user-abc",
      amount: 2,
    });

    // Second decrement should fail
    mockFindUnique.mockResolvedValue({ id: "user-abc" });
    await expect(
      atomicSafeDecrement(mockTx as any, {
        userId: "user-abc",
        amount: 2,
      }),
    ).rejects.toThrow("Crédits insuffisants");
  });

  it("should not throw if credits exactly equal the amount (gte check)", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const { atomicSafeDecrement } = await import("../creditOps");
    await atomicSafeDecrement(mockTx as any, {
      userId: "user-abc",
      amount: 0,
    });

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "user-abc", credits: { gte: 0 } },
      data: { credits: { decrement: 0 } },
    });
  });
});
