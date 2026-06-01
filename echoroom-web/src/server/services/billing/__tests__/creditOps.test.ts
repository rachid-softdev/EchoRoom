import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// atomicDebit & atomicRefund — Credit operations tests
// ---------------------------------------------------------------------------
// These functions use the Prisma transaction client pattern with the new
// UserBilling sub-aggregate (Sprint 4 partition).
//
// Uses tx.userBilling exclusively (legacy User.credits fallback removed).

describe("atomicDebit", () => {
  let mockBillingUpdateMany: ReturnType<typeof vi.fn>;
  let mockFindUnique: ReturnType<typeof vi.fn>;
  let mockTx: Record<string, any>;

  beforeEach(() => {
    vi.resetAllMocks();
    mockBillingUpdateMany = vi.fn();
    mockFindUnique = vi.fn();

    mockTx = {
      userBilling: { updateMany: mockBillingUpdateMany },
      user: {
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
  });

  it("should return INSUFFICIENT_CREDITS when UserBilling debit fails and user exists", async () => {
    mockBillingUpdateMany.mockResolvedValue({ count: 0 });
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
  let mockBillingUpsert: ReturnType<typeof vi.fn>;
  let mockTx: Record<string, any>;

  beforeEach(() => {
    vi.resetAllMocks();
    mockBillingUpsert = vi.fn();

    mockTx = {
      userBilling: {
        upsert: mockBillingUpsert,
      },
    };
  });

  it("should refund via UserBilling upsert", async () => {
    mockBillingUpsert.mockResolvedValue({ id: "billing-1", credits: 15 });

    const { atomicRefund } = await import("../creditOps");
    await atomicRefund(mockTx as any, {
      userId: "user-abc",
      amount: 5,
    });

    expect(mockBillingUpsert).toHaveBeenCalledWith({
      where: { userId: "user-abc" },
      create: { userId: "user-abc", credits: 5 },
      update: { credits: { increment: 5 } },
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

    expect(mockBillingUpsert).not.toHaveBeenCalled();
  });

  it("should handle large refund amounts via UserBilling", async () => {
    mockBillingUpsert.mockResolvedValue({ credits: 100000 });

    const { atomicRefund } = await import("../creditOps");
    await atomicRefund(mockTx as any, {
      userId: "user-abc",
      amount: 50000,
    });

    expect(mockBillingUpsert).toHaveBeenCalledWith({
      where: { userId: "user-abc" },
      create: { userId: "user-abc", credits: 50000 },
      update: { credits: { increment: 50000 } },
    });
  });

  it("should handle refund for user without existing billing record (upsert creates)", async () => {
    mockBillingUpsert.mockResolvedValue({ id: "billing-new", credits: 5 });

    const { atomicRefund } = await import("../creditOps");
    await atomicRefund(mockTx as any, { userId: "new-user", amount: 5 });

    expect(mockBillingUpsert).toHaveBeenCalledWith({
      where: { userId: "new-user" },
      create: { userId: "new-user", credits: 5 },
      update: { credits: { increment: 5 } },
    });
  });
});

describe("atomicSafeDecrement", () => {
  let mockBillingUpdateMany: ReturnType<typeof vi.fn>;
  let mockFindUnique: ReturnType<typeof vi.fn>;
  let mockTx: Record<string, any>;

  beforeEach(() => {
    vi.resetAllMocks();
    mockBillingUpdateMany = vi.fn();
    mockFindUnique = vi.fn();

    mockTx = {
      userBilling: { updateMany: mockBillingUpdateMany },
      user: {
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
  });

  it("should throw INSUFFICIENT_CREDITS when UserBilling has insufficient credits", async () => {
    mockBillingUpdateMany.mockResolvedValue({ count: 0 });
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
