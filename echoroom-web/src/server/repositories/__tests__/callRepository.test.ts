import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// PrismaCallRepository tests
// ---------------------------------------------------------------------------
// Tests for callRepository.ts:
//   - findById: lookup call by primary key
//   - findWithDetails: selective field retrieval
//   - updateStatusWithGuard: atomic status transition with guard
//   - markAsFailedWithRefund: transactional fail + credit refund
//     (Sprint 4: prefers UserBilling sub-aggregate for refund)

describe("PrismaCallRepository — findById", () => {
  let mockFindUnique: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockFindUnique = vi.fn();
    mockDb = { call: { findUnique: mockFindUnique } as any };
    const { PrismaCallRepository } = await import("../callRepository");
    repo = new PrismaCallRepository(mockDb as PrismaClient);
  });

  it("should return a call when found by id", async () => {
    const mockCall = {
      id: "call-1",
      userId: "user-1",
      phoneNumber: "encrypted-data",
      status: "ACTIVE",
      costCredits: 5,
    };
    mockFindUnique.mockResolvedValue(mockCall);

    const result = await repo.findById("call-1");

    expect(result).toEqual(mockCall);
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "call-1" } });
  });

  it("should return null when call not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await repo.findById("nonexistent");

    expect(result).toBeNull();
  });
});

describe("PrismaCallRepository — findWithDetails", () => {
  let mockFindUnique: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockFindUnique = vi.fn();
    mockDb = { call: { findUnique: mockFindUnique } as any };
    const { PrismaCallRepository } = await import("../callRepository");
    repo = new PrismaCallRepository(mockDb as PrismaClient);
  });

  it("should return only the selected fields", async () => {
    mockFindUnique.mockResolvedValue({
      id: "call-1",
      userId: "user-1",
      costCredits: 10,
      status: "COMPLETED",
    });

    const result = await repo.findWithDetails("call-1");

    expect(result).toEqual({
      id: "call-1",
      userId: "user-1",
      costCredits: 10,
      status: "COMPLETED",
    });
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "call-1" },
      select: { id: true, userId: true, costCredits: true, status: true },
    });
  });

  it("should not select phoneNumber or transcript fields (Prisma select projection)", async () => {
    const fullCall = {
      id: "call-1",
      userId: "user-1",
      costCredits: 10,
      status: "ACTIVE",
      phoneNumber: "encrypted-sensitive",
      transcript: { sensitive: "data" } as any,
    };
    mockFindUnique.mockResolvedValue(fullCall);

    await repo.findWithDetails("call-1");

    // Verify only the selected fields are in the Prisma query
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "call-1" },
      select: { id: true, userId: true, costCredits: true, status: true },
    });
    // The mock returns all fields (it doesn't implement Prisma's select projection)
    // but the real Prisma would only return the fields listed in `select`.
    // This test verifies the correct `select` is passed to Prisma.
  });
});

describe("PrismaCallRepository — updateStatusWithGuard", () => {
  let mockUpdateMany: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockUpdateMany = vi.fn();
    mockDb = { call: { updateMany: mockUpdateMany } as any };
    const { PrismaCallRepository } = await import("../callRepository");
    repo = new PrismaCallRepository(mockDb as PrismaClient);
  });

  it("should update status with current status guard", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const count = await repo.updateStatusWithGuard(
      "call-1",
      "RINGING" as any,
      "ACTIVE" as any,
    );

    expect(count).toBe(1);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "call-1", status: "RINGING" },
      data: { status: "ACTIVE" },
    });
  });

  it("should return 0 when status guard prevents update", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });

    const count = await repo.updateStatusWithGuard(
      "call-1",
      "RINGING" as any,
      "ACTIVE" as any,
    );

    expect(count).toBe(0);
  });

  it("should include additional data when provided", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    await repo.updateStatusWithGuard(
      "call-1",
      "ACTIVE" as any,
      "COMPLETED" as any,
      { durationSeconds: 120, endedAt: new Date("2026-06-01T00:00:00Z") },
    );

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "call-1", status: "ACTIVE" },
      data: {
        status: "COMPLETED",
        durationSeconds: 120,
        endedAt: new Date("2026-06-01T00:00:00Z"),
      },
    });
  });

  it("should handle transition FAILED to FAILED (idempotent)", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const count = await repo.updateStatusWithGuard(
      "call-1",
      "FAILED" as any,
      "FAILED" as any,
    );

    expect(count).toBe(1);
  });
});

describe("PrismaCallRepository — markAsFailedWithRefund", () => {
  let mockTransaction: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockTransaction = vi.fn();
    mockDb = { $transaction: mockTransaction } as any;
    const { PrismaCallRepository } = await import("../callRepository");
    repo = new PrismaCallRepository(mockDb as PrismaClient);
  });

  it("should mark call as FAILED and refund via UserBilling (preferred)", async () => {
    const mockCallUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const mockCallFindUnique = vi.fn().mockResolvedValue({
      userId: "user-1",
      costCredits: 5,
    });
    const mockBillingUpsert = vi.fn().mockResolvedValue({ id: "billing-1" });

    mockTransaction.mockImplementation(async (cb: (tx: any) => Promise<void>) => {
      await cb({
        call: {
          updateMany: mockCallUpdateMany,
          findUnique: mockCallFindUnique,
        },
        userBilling: {
          upsert: mockBillingUpsert,
        },
      });
    });

    await repo.markAsFailedWithRefund("call-1", 30);

    expect(mockCallUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "call-1",
        status: { notIn: ["FAILED", "COMPLETED"] },
      },
      data: {
        status: "FAILED",
        durationSeconds: 30,
        endedAt: expect.any(Date),
      },
    });
    expect(mockBillingUpsert).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      create: { userId: "user-1", credits: 5 },
      update: { credits: { increment: 5 } },
    });
  });

  it("should refund via UserBilling when call is active (no legacy fallback)", async () => {
    const mockCallUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const mockCallFindUnique = vi.fn().mockResolvedValue({
      userId: "user-1",
      costCredits: 5,
    });
    const mockBillingUpsert = vi.fn().mockResolvedValue({ id: "billing-1" });

    mockTransaction.mockImplementation(async (cb: (tx: any) => Promise<void>) => {
      await cb({
        call: {
          updateMany: mockCallUpdateMany,
          findUnique: mockCallFindUnique,
        },
        userBilling: {
          upsert: mockBillingUpsert,
        },
      });
    });

    await repo.markAsFailedWithRefund("call-1", 30);

    // UserBilling upsert should always be called — no legacy fallback
    expect(mockBillingUpsert).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      create: { userId: "user-1", credits: 5 },
      update: { credits: { increment: 5 } },
    });
  });

  it("should NOT refund when call is already FAILED or COMPLETED", async () => {
    const mockCallUpdateMany = vi.fn().mockResolvedValue({ count: 0 });
    const mockCallFindUnique = vi.fn();
    const mockBillingUpsert = vi.fn();

    mockTransaction.mockImplementation(async (cb: (tx: any) => Promise<void>) => {
      await cb({
        call: {
          updateMany: mockCallUpdateMany,
          findUnique: mockCallFindUnique,
        },
        userBilling: { upsert: mockBillingUpsert },
      });
    });

    await repo.markAsFailedWithRefund("call-1", 30);

    expect(mockCallUpdateMany).toHaveBeenCalled();
    // Should not attempt refund if no rows updated
    expect(mockCallFindUnique).not.toHaveBeenCalled();
    expect(mockBillingUpsert).not.toHaveBeenCalled();
  });

  it("should handle missing call record gracefully (no crash)", async () => {
    const mockCallUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const mockCallFindUnique = vi.fn().mockResolvedValue(null);
    const mockBillingUpsert = vi.fn();

    mockTransaction.mockImplementation(async (cb: (tx: any) => Promise<void>) => {
      await cb({
        call: {
          updateMany: mockCallUpdateMany,
          findUnique: mockCallFindUnique,
        },
        userBilling: { upsert: mockBillingUpsert },
      });
    });

    // Should not throw when call record disappears between update and find
    await expect(repo.markAsFailedWithRefund("call-1", 30)).resolves.not.toThrow();
  });

  it("should be idempotent for already-completed calls", async () => {
    const mockCallUpdateMany = vi.fn().mockResolvedValue({ count: 0 });
    mockTransaction.mockImplementation(async (cb: (tx: any) => Promise<void>) => {
      await cb({ call: { updateMany: mockCallUpdateMany } });
    });

    await repo.markAsFailedWithRefund("call-1", 0);

    expect(mockCallUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { notIn: ["FAILED", "COMPLETED"] },
        }),
      }),
    );
  });
});
