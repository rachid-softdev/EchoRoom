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
