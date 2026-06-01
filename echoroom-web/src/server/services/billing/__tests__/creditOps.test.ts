import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// atomicDebit & atomicRefund — Credit operations tests
// ---------------------------------------------------------------------------
// These functions use the Prisma transaction client pattern with the new
// UserBilling sub-aggregate (Sprint 4 partition).
//
// Prefers tx.userBilling, falls back to tx.user (legacy).

describe("atomicDebit", () => {
  let mockBillingUpdateMany: ReturnType<typeof vi.fn>;
  let mockLegacyUpdateMany: ReturnType<typeof vi.fn>;
  let mockFindUnique: ReturnType<typeof vi.fn>;
  let mockTx: Record<string, any>;

  beforeEach(() => {
    vi.resetAllMocks();
    mockBillingUpdateMany = vi.fn();
    mockLegacyUpdateMany = vi.fn();
    mockFindUnique = vi.fn();

    mockTx = {
      userBilling: { updateMany: mockBillingUpdateMany },
      user: {
        updateMany: mockLegacyUpdateMany,
        findUnique: mockFindUnique,
      },
    };
  });

  it("should debit from UserBilling when record exists", async () => {
    mockBillingUpdateMany.mockResolvedValue({ count: 1 });

    const { atomicDebit } = await import("../creditOps");
    const result = await atomicDebit(mockTx as any, {
      userId: "user-abc",
      cost: 5,
    });

    expect(result).toEqual({ debited: true });
    expect(mockBillingUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user-abc", credits: { gte: 5 } },
      data: { credits: { decrement: 5 } },
    });
    // Should NOT call legacy fallback
    expect(mockLegacyUpdateMany).not.toHaveBeenCalled();
  });

  it("should fall back to legacy User.credits when UserBilling not found", async () => {
    mockBillingUpdateMany.mockResolvedValue({ count: 0 });
    mockLegacyUpdateMany.mockResolvedValue({ count: 1 });

    const { atomicDebit } = await import("../creditOps");
    const result = await atomicDebit(mockTx as any, {
      userId: "user-abc",
      cost: 5,
    });

    expect(result).toEqual({ debited: true });
    expect(mockLegacyUpdateMany).toHaveBeenCalledWith({
      where: { id: "user-abc", credits: { gte: 5 } },
      data: { credits: { decrement: 5 } },
    });
  });

  it("should return INSUFFICIENT_CREDITS when both fail and user exists", async () => {
    mockBillingUpdateMany.mockResolvedValue({ count: 0 });
    mockLegacyUpdateMany.mockResolvedValue({ count: 0 });
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
  });

  it("should return USER_NOT_FOUND when user doesn't exist", async () => {
    mockBillingUpdateMany.mockResolvedValue({ count: 0 });
    mockLegacyUpdateMany.mockResolvedValue({ count: 0 });
    mockFindUnique.mockResolvedValue(null);

    const { atomicDebit } = await import("../creditOps");
    const result = await atomicDebit(mockTx as any, {
      userId: "nonexistent",
      cost: 5,
    });

    expect(result).toEqual({
      debited: false,
      reason: "USER_NOT_FOUND",
    });
  });

  it("should handle zero cost via UserBilling", async () => {
    mockBillingUpdateMany.mockResolvedValue({ count: 1 });

    const { atomicDebit } = await import("../creditOps");
    const result = await atomicDebit(mockTx as any, {
      userId: "user-abc",
      cost: 0,
    });

    expect(result).toEqual({ debited: true });
    expect(mockBillingUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user-abc", credits: { gte: 0 } },
      data: { credits: { decrement: 0 } },
    });
  });

  it("should handle large cost values", async () => {
    mockBillingUpdateMany.mockResolvedValue({ count: 1 });

    const { atomicDebit } = await import("../creditOps");
    const result = await atomicDebit(mockTx as any, {
      userId: "user-abc",
      cost: 99999,
    });

    expect(result).toEqual({ debited: true });
  });

  it("should prevent race conditions through atomic WHERE clause", async () => {
    mockBillingUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    mockLegacyUpdateMany.mockResolvedValue({ count: 0 });
    mockFindUnique.mockResolvedValue({ id: "user-abc" });

    const { atomicDebit } = await import("../creditOps");

    const result1 = await atomicDebit(mockTx as any, {
      userId: "user-abc",
      cost: 5,
    });
    expect(result1).toEqual({ debited: true });

    const result2 = await atomicDebit(mockTx as any, {
      userId: "user-abc",
      cost: 5,
    });
    expect(result2).toEqual({
      debited: false,
      reason: "INSUFFICIENT_CREDITS",
    });
  });
});

describe("atomicRefund", () => {
  let mockBillingFindUnique: ReturnType<typeof vi.fn>;
  let mockBillingUpdate: ReturnType<typeof vi.fn>;
  let mockLegacyUpdate: ReturnType<typeof vi.fn>;
  let mockTx: Record<string, any>;

  beforeEach(() => {
    vi.resetAllMocks();
    mockBillingFindUnique = vi.fn();
    mockBillingUpdate = vi.fn();
    mockLegacyUpdate = vi.fn();

    mockTx = {
      userBilling: {
        findUnique: mockBillingFindUnique,
        update: mockBillingUpdate,
      },
      user: { update: mockLegacyUpdate },
    };
  });

  it("should refund to UserBilling when record exists", async () => {
    mockBillingFindUnique.mockResolvedValue({ id: "billing-1" });
    mockBillingUpdate.mockResolvedValue({ credits: 15 });

    const { atomicRefund } = await import("../creditOps");
    await atomicRefund(mockTx as any, {
      userId: "user-abc",
      amount: 5,
    });

    expect(mockBillingUpdate).toHaveBeenCalledWith({
      where: { userId: "user-abc" },
      data: { credits: { increment: 5 } },
    });
    expect(mockLegacyUpdate).not.toHaveBeenCalled();
  });

  it("should fall back to legacy User.credits when UserBilling not found", async () => {
    mockBillingFindUnique.mockResolvedValue(null);
    mockLegacyUpdate.mockResolvedValue({ id: "user-abc", credits: 15 });

    const { atomicRefund } = await import("../creditOps");
    await atomicRefund(mockTx as any, {
      userId: "user-abc",
      amount: 5,
    });

    expect(mockLegacyUpdate).toHaveBeenCalledWith({
      where: { id: "user-abc" },
      data: { credits: { increment: 5 } },
    });
  });

  it("should throw BAD_REQUEST when refunding zero amount", async () => {
    const { atomicRefund } = await import("../creditOps");
    await expect(
      atomicRefund(mockTx as any, {
        userId: "user-abc",
        amount: 0,
      }),
    ).rejects.toThrow("Le montant du remboursement doit être positif");

    expect(mockBillingUpdate).not.toHaveBeenCalled();
  });

  it("should handle large refund amounts via UserBilling", async () => {
    mockBillingFindUnique.mockResolvedValue({ id: "billing-1" });
    mockBillingUpdate.mockResolvedValue({ credits: 100000 });

    const { atomicRefund } = await import("../creditOps");
    await atomicRefund(mockTx as any, {
      userId: "user-abc",
      amount: 50000,
    });

    expect(mockBillingUpdate).toHaveBeenCalledWith({
      where: { userId: "user-abc" },
      data: { credits: { increment: 50000 } },
    });
  });

  it("should throw when user doesn't exist in both models", async () => {
    mockBillingFindUnique.mockResolvedValue(null);
    mockLegacyUpdate.mockRejectedValue(new Error("Record to update not found."));

    const { atomicRefund } = await import("../creditOps");
    await expect(
      atomicRefund(mockTx as any, { userId: "nonexistent", amount: 5 }),
    ).rejects.toThrow("Record to update not found.");
  });
});

describe("atomicSafeDecrement", () => {
  let mockBillingUpdateMany: ReturnType<typeof vi.fn>;
  let mockLegacyUpdateMany: ReturnType<typeof vi.fn>;
  let mockFindUnique: ReturnType<typeof vi.fn>;
  let mockTx: Record<string, any>;

  beforeEach(() => {
    vi.resetAllMocks();
    mockBillingUpdateMany = vi.fn();
    mockLegacyUpdateMany = vi.fn();
    mockFindUnique = vi.fn();

    mockTx = {
      userBilling: { updateMany: mockBillingUpdateMany },
      user: {
        updateMany: mockLegacyUpdateMany,
        findUnique: mockFindUnique,
      },
    };
  });

  it("should decrement via UserBilling when record exists", async () => {
    mockBillingUpdateMany.mockResolvedValue({ count: 1 });

    const { atomicSafeDecrement } = await import("../creditOps");
    await atomicSafeDecrement(mockTx as any, {
      userId: "user-abc",
      amount: 5,
    });

    expect(mockBillingUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user-abc", credits: { gte: 5 } },
      data: { credits: { decrement: 5 } },
    });
    expect(mockLegacyUpdateMany).not.toHaveBeenCalled();
  });

  it("should fall back to legacy User.credits when UserBilling has insufficient", async () => {
    mockBillingUpdateMany.mockResolvedValue({ count: 0 });
    mockLegacyUpdateMany.mockResolvedValue({ count: 1 });

    const { atomicSafeDecrement } = await import("../creditOps");
    await atomicSafeDecrement(mockTx as any, {
      userId: "user-abc",
      amount: 5,
    });

    expect(mockLegacyUpdateMany).toHaveBeenCalledWith({
      where: { id: "user-abc", credits: { gte: 5 } },
      data: { credits: { decrement: 5 } },
    });
  });

  it("should throw INSUFFICIENT_CREDITS when both fail and user exists", async () => {
    mockBillingUpdateMany.mockResolvedValue({ count: 0 });
    mockLegacyUpdateMany.mockResolvedValue({ count: 0 });
    mockFindUnique.mockResolvedValue({ id: "user-abc" });

    const { atomicSafeDecrement } = await import("../creditOps");
    await expect(
      atomicSafeDecrement(mockTx as any, {
        userId: "user-abc",
        amount: 999,
      }),
    ).rejects.toThrow("Crédits insuffisants");
  });

  it("should throw USER_NOT_FOUND when user does not exist", async () => {
    mockBillingUpdateMany.mockResolvedValue({ count: 0 });
    mockLegacyUpdateMany.mockResolvedValue({ count: 0 });
    mockFindUnique.mockResolvedValue(null);

    const { atomicSafeDecrement } = await import("../creditOps");
    await expect(
      atomicSafeDecrement(mockTx as any, {
        userId: "nonexistent",
        amount: 5,
      }),
    ).rejects.toThrow("Utilisateur introuvable");
  });

  it("should throw BAD_REQUEST when decrementing zero amount", async () => {
    const { atomicSafeDecrement } = await import("../creditOps");
    await expect(
      atomicSafeDecrement(mockTx as any, {
        userId: "user-abc",
        amount: 0,
      }),
    ).rejects.toThrow("Le montant du débit doit être positif");

    expect(mockBillingUpdateMany).not.toHaveBeenCalled();
  });

  it("should throw AppError with correct codes", async () => {
    mockBillingUpdateMany.mockResolvedValue({ count: 0 });
    mockLegacyUpdateMany.mockResolvedValue({ count: 0 });
    mockFindUnique.mockResolvedValue({ id: "user-abc" });

    const { atomicSafeDecrement } = await import("../creditOps");
    const { AppError } = await import("@/server/lib/errors");

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

  it("should prevent negative credits via WHERE credits gte guard", async () => {
    mockBillingUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    mockLegacyUpdateMany.mockResolvedValue({ count: 0 });
    mockFindUnique.mockResolvedValue({ id: "user-abc" });

    const { atomicSafeDecrement } = await import("../creditOps");

    await atomicSafeDecrement(mockTx as any, {
      userId: "user-abc",
      amount: 2,
    });

    mockFindUnique.mockResolvedValue({ id: "user-abc" });
    await expect(
      atomicSafeDecrement(mockTx as any, {
        userId: "user-abc",
        amount: 2,
      }),
    ).rejects.toThrow("Crédits insuffisants");
  });
});
