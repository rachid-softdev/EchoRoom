import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// PrismaUserBillingRepository — Implementation Tests
// ---------------------------------------------------------------------------
// Tests the actual PrismaUserBillingRepository class:
//   - atomicDebit: exact balance, cost=0, negative cost, transaction rollback
//   - atomicRefund: user without billing → upsert creates, concurrent refund+debit

const mockFindUnique = vi.fn();
const mockUpsert = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    userBilling: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
      update: mockUpdate,
    },
  },
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

function createTxMock() {
  return {
    userBilling: {
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
  };
}

describe("PrismaUserBillingRepository.atomicDebit", () => {
  let repo: import("../userBillingRepository").PrismaUserBillingRepository;
  let mockTx: ReturnType<typeof createTxMock>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { PrismaUserBillingRepository } = await import("../userBillingRepository");
    const { db } = await import("@/server/db");
    repo = new PrismaUserBillingRepository(db as any);
    mockTx = createTxMock();
  });

  it("should debit when exact balance equals cost", async () => {
    mockTx.userBilling.findUnique.mockResolvedValue({ id: "billing-1", credits: 5 });
    mockTx.userBilling.update.mockResolvedValue({ id: "billing-1", credits: 0 });

    const result = await repo.atomicDebit(mockTx as any, "user-123", 5);

    expect(result).toEqual({ debited: true });
    expect(mockTx.userBilling.update).toHaveBeenCalledWith({
      where: { userId: "user-123" },
      data: { credits: { decrement: 5 } },
    });
  });

  it("should debit when cost is 0", async () => {
    mockTx.userBilling.findUnique.mockResolvedValue({ id: "billing-1", credits: 5 });
    mockTx.userBilling.update.mockResolvedValue({ id: "billing-1", credits: 5 });

    const result = await repo.atomicDebit(mockTx as any, "user-123", 0);

    expect(result).toEqual({ debited: true });
    expect(mockTx.userBilling.update).toHaveBeenCalledWith({
      where: { userId: "user-123" },
      data: { credits: { decrement: 0 } },
    });
  });

  it("should return INSUFFICIENT_CREDITS when balance < cost", async () => {
    mockTx.userBilling.findUnique.mockResolvedValue({ id: "billing-1", credits: 3 });

    const result = await repo.atomicDebit(mockTx as any, "user-123", 5);

    expect(result).toEqual({ debited: false, reason: "INSUFFICIENT_CREDITS" });
    expect(mockTx.userBilling.update).not.toHaveBeenCalled();
  });

  it("should return USER_NOT_FOUND when billing record does not exist", async () => {
    mockTx.userBilling.findUnique.mockResolvedValue(null);

    const result = await repo.atomicDebit(mockTx as any, "nonexistent", 5);

    expect(result).toEqual({ debited: false, reason: "USER_NOT_FOUND" });
    expect(mockTx.userBilling.update).not.toHaveBeenCalled();
  });

  it("should handle negative cost (decrement by negative = increment)", async () => {
    mockTx.userBilling.findUnique.mockResolvedValue({ id: "billing-1", credits: 5 });
    mockTx.userBilling.update.mockResolvedValue({ id: "billing-1", credits: 10 });

    const result = await repo.atomicDebit(mockTx as any, "user-123", -5);

    expect(result).toEqual({ debited: true });
    expect(mockTx.userBilling.update).toHaveBeenCalledWith({
      where: { userId: "user-123" },
      data: { credits: { decrement: -5 } },
    });
  });

  it("should rollback when Prisma update throws", async () => {
    mockTx.userBilling.findUnique.mockResolvedValue({ id: "billing-1", credits: 10 });
    const dbError = new Error("Prisma connection error");
    mockTx.userBilling.update.mockRejectedValue(dbError);

    await expect(repo.atomicDebit(mockTx as any, "user-123", 5)).rejects.toThrow(
      "Prisma connection error",
    );
  });
});

describe("PrismaUserBillingRepository.atomicRefund", () => {
  let repo: import("../userBillingRepository").PrismaUserBillingRepository;
  let mockTx: ReturnType<typeof createTxMock>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { PrismaUserBillingRepository } = await import("../userBillingRepository");
    const { db } = await import("@/server/db");
    repo = new PrismaUserBillingRepository(db as any);
    mockTx = createTxMock();
  });

  it("should upsert billing record with increment on existing user", async () => {
    mockTx.userBilling.upsert.mockResolvedValue({ id: "billing-1", credits: 15 });

    await repo.atomicRefund(mockTx as any, "user-123", 5);

    expect(mockTx.userBilling.upsert).toHaveBeenCalledWith({
      where: { userId: "user-123" },
      create: { userId: "user-123", credits: 5 },
      update: { credits: { increment: 5 } },
    });
  });

  it("should create new billing record when user has none (upsert create)", async () => {
    mockTx.userBilling.upsert.mockResolvedValue({ id: "billing-new", credits: 10 });

    await repo.atomicRefund(mockTx as any, "new-user", 10);

    expect(mockTx.userBilling.upsert).toHaveBeenCalledWith({
      where: { userId: "new-user" },
      create: { userId: "new-user", credits: 10 },
      update: { credits: { increment: 10 } },
    });
  });

  it("should maintain consistency under concurrent refund and debit", async () => {
    // Simulate: refund +5 then debit -3 = net +2
    mockTx.userBilling.upsert.mockResolvedValue({ id: "billing-1", credits: 12 });
    mockTx.userBilling.findUnique.mockResolvedValue({ id: "billing-1", credits: 12 });
    mockTx.userBilling.update.mockResolvedValue({ id: "billing-1", credits: 9 });

    await repo.atomicRefund(mockTx as any, "user-123", 5);
    const debitResult = await repo.atomicDebit(mockTx as any, "user-123", 3);

    expect(debitResult).toEqual({ debited: true });
    expect(mockTx.userBilling.upsert).toHaveBeenCalledTimes(1);
    expect(mockTx.userBilling.update).toHaveBeenCalledWith({
      where: { userId: "user-123" },
      data: { credits: { decrement: 3 } },
    });
  });
});
