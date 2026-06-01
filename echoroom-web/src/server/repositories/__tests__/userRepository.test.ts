import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// PrismaUserRepository — CRUD operations tests
// ---------------------------------------------------------------------------
// Tests for userRepository.ts (Sprint 4 partitioned version):
//   - atomicDebit: prefers UserBilling, falls back to legacy User.credits
//   - atomicRefund: prefers UserBilling, falls back to legacy User
//   - anonymize: uses UserProfile upsert + legacy User + related entities

describe("PrismaUserRepository — findById", () => {
  let mockFindUnique: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockFindUnique = vi.fn();
    mockDb = { user: { findUnique: mockFindUnique } as any };
    const { PrismaUserRepository } = await import("../userRepository");
    repo = new PrismaUserRepository(mockDb as PrismaClient);
  });

  it("should return a user when found by id", async () => {
    const mockUser = {
      id: "user-1",
      email: "test@example.com",
      username: "testuser",
      role: "USER",
      credits: 10,
    };
    mockFindUnique.mockResolvedValue(mockUser);

    const result = await repo.findById("user-1");

    expect(result).toEqual(mockUser);
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "user-1" } });
  });

  it("should return null when user is not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await repo.findById("nonexistent");

    expect(result).toBeNull();
  });

  it("should propagate Prisma errors", async () => {
    mockFindUnique.mockRejectedValue(new Error("DB connection failed"));

    await expect(repo.findById("user-1")).rejects.toThrow("DB connection failed");
  });
});

describe("PrismaUserRepository — findByIdWithCredits", () => {
  let mockFindUnique: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockFindUnique = vi.fn();
    mockDb = { user: { findUnique: mockFindUnique } as any };
    const { PrismaUserRepository } = await import("../userRepository");
    repo = new PrismaUserRepository(mockDb as PrismaClient);
  });

  it("should return only id and credits when found", async () => {
    mockFindUnique.mockResolvedValue({ id: "user-1", credits: 25 });

    const result = await repo.findByIdWithCredits("user-1");

    expect(result).toEqual({ id: "user-1", credits: 25 });
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { id: true, credits: true },
    });
  });

  it("should return null when user not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await repo.findByIdWithCredits("nonexistent");

    expect(result).toBeNull();
  });
});

describe("PrismaUserRepository — update", () => {
  let mockUpdate: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockUpdate = vi.fn();
    mockDb = { user: { update: mockUpdate } as any };
    const { PrismaUserRepository } = await import("../userRepository");
    repo = new PrismaUserRepository(mockDb as PrismaClient);
  });

  it("should update a single field", async () => {
    mockUpdate.mockResolvedValue({ id: "user-1", displayName: "New Name" });

    const result = await repo.update("user-1", { displayName: "New Name" });

    expect(result.displayName).toBe("New Name");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { displayName: "New Name" },
    });
  });

  it("should throw when user does not exist", async () => {
    mockUpdate.mockRejectedValue(new Error("Record to update not found."));

    await expect(
      repo.update("nonexistent", { displayName: "Ghost" }),
    ).rejects.toThrow("Record to update not found.");
  });
});

describe("PrismaUserRepository — updateMany", () => {
  let mockUpdateMany: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockUpdateMany = vi.fn();
    mockDb = { user: { updateMany: mockUpdateMany } as any };
    const { PrismaUserRepository } = await import("../userRepository");
    repo = new PrismaUserRepository(mockDb as PrismaClient);
  });

  it("should return count of updated records", async () => {
    mockUpdateMany.mockResolvedValue({ count: 3 });

    const count = await repo.updateMany(
      { deletedAt: null },
      { deletedAt: new Date() },
    );

    expect(count).toBe(3);
  });

  it("should return 0 when no records match", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });

    const count = await repo.updateMany(
      { id: "nonexistent", deletedAt: null },
      { deletedAt: new Date() },
    );

    expect(count).toBe(0);
  });
});

describe("PrismaUserRepository — atomicDebit", () => {
  let mockBillingFindUnique: ReturnType<typeof vi.fn>;
  let mockBillingUpdate: ReturnType<typeof vi.fn>;
  let mockUserFindUnique: ReturnType<typeof vi.fn>;
  let mockUserUpdate: ReturnType<typeof vi.fn>;
  let mockTx: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockBillingFindUnique = vi.fn();
    mockBillingUpdate = vi.fn();
    mockUserFindUnique = vi.fn();
    mockUserUpdate = vi.fn();
    mockTx = {
      userBilling: { findUnique: mockBillingFindUnique, update: mockBillingUpdate },
      user: { findUnique: mockUserFindUnique, update: mockUserUpdate },
    };
    const { PrismaUserRepository } = await import("../userRepository");
    const { PrismaClient } = await import("@prisma/client");
    // @ts-expect-error - partial mock for testing
    repo = new PrismaUserRepository({} as PrismaClient);
  });

  let repo: any;

  it("should debit from UserBilling when record exists", async () => {
    mockBillingFindUnique.mockResolvedValue({ credits: 10 });

    const result = await repo.atomicDebit(mockTx, "user-1", 5);

    expect(result).toEqual({ debited: true });
    expect(mockBillingUpdate).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { credits: { decrement: 5 } },
    });
  });

  it("should debit exactly the balance (edge case)", async () => {
    mockBillingFindUnique.mockResolvedValue({ credits: 5 });

    const result = await repo.atomicDebit(mockTx, "user-1", 5);

    expect(result).toEqual({ debited: true });
  });

  it("should return INSUFFICIENT_CREDITS from UserBilling", async () => {
    mockBillingFindUnique.mockResolvedValue({ credits: 2 });

    const result = await repo.atomicDebit(mockTx, "user-1", 5);

    expect(result).toEqual({
      debited: false,
      reason: "INSUFFICIENT_CREDITS",
    });
    expect(mockBillingUpdate).not.toHaveBeenCalled();
  });

  it("should fall back to legacy User.credits when UserBilling not found", async () => {
    mockBillingFindUnique.mockResolvedValue(null);
    mockUserFindUnique.mockResolvedValue({ id: "user-1", credits: 10 });

    const result = await repo.atomicDebit(mockTx, "user-1", 5);

    expect(result).toEqual({ debited: true });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { credits: { decrement: 5 } },
    });
  });

  it("should return USER_NOT_FOUND when neither UserBilling nor User exists", async () => {
    mockBillingFindUnique.mockResolvedValue(null);
    mockUserFindUnique.mockResolvedValue(null);

    const result = await repo.atomicDebit(mockTx, "nonexistent", 5);

    expect(result).toEqual({
      debited: false,
      reason: "USER_NOT_FOUND",
    });
  });
});

describe("PrismaUserRepository — atomicRefund", () => {
  let mockBillingFindUnique: ReturnType<typeof vi.fn>;
  let mockBillingUpdate: ReturnType<typeof vi.fn>;
  let mockUserUpdate: ReturnType<typeof vi.fn>;
  let mockTx: any;
  let repo: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockBillingFindUnique = vi.fn();
    mockBillingUpdate = vi.fn();
    mockUserUpdate = vi.fn();
    mockTx = {
      userBilling: { findUnique: mockBillingFindUnique, update: mockBillingUpdate },
      user: { update: mockUserUpdate },
    };
    const { PrismaUserRepository } = await import("../userRepository");
    const { PrismaClient } = await import("@prisma/client");
    // @ts-expect-error - partial mock for testing
    repo = new PrismaUserRepository({} as PrismaClient);
  });

  it("should refund to UserBilling when record exists", async () => {
    mockBillingFindUnique.mockResolvedValue({ id: "billing-1" });

    await repo.atomicRefund(mockTx, "user-1", 5);

    expect(mockBillingUpdate).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { credits: { increment: 5 } },
    });
  });

  it("should fall back to legacy User.credits when UserBilling not found", async () => {
    mockBillingFindUnique.mockResolvedValue(null);

    await repo.atomicRefund(mockTx, "user-1", 5);

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { credits: { increment: 5 } },
    });
  });
});

describe("PrismaUserRepository — anonymize", () => {
  let mockProfileUpsert: ReturnType<typeof vi.fn>;
  let mockUserUpdate: ReturnType<typeof vi.fn>;
  let mockScenarioUpdateMany: ReturnType<typeof vi.fn>;
  let mockCommentUpdateMany: ReturnType<typeof vi.fn>;
  let mockCallUpdateMany: ReturnType<typeof vi.fn>;
  let mockTx: any;
  let repo: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockProfileUpsert = vi.fn();
    mockUserUpdate = vi.fn();
    mockScenarioUpdateMany = vi.fn();
    mockCommentUpdateMany = vi.fn();
    mockCallUpdateMany = vi.fn();
    mockTx = {
      userProfile: { upsert: mockProfileUpsert },
      user: { update: mockUserUpdate },
      scenario: { updateMany: mockScenarioUpdateMany },
      comment: { updateMany: mockCommentUpdateMany },
      call: { updateMany: mockCallUpdateMany },
    };
    const { PrismaUserRepository } = await import("../userRepository");
    const { PrismaClient } = await import("@prisma/client");
    // @ts-expect-error - partial mock for testing
    repo = new PrismaUserRepository({} as PrismaClient);
  });

  it("should upsert UserProfile to clear displayName, bio, image", async () => {
    await repo.anonymize(mockTx, "user-1");

    expect(mockProfileUpsert).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      create: { userId: "user-1" },
      update: {
        image: null,
        displayName: null,
        bio: null,
      },
    });
  });

  it("should also clear legacy User fields", async () => {
    await repo.anonymize(mockTx, "user-1");

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        image: null,
        displayName: null,
        bio: null,
      },
    });
  });

  it("should set all scenarios to PRIVATE", async () => {
    await repo.anonymize(mockTx, "user-1");

    expect(mockScenarioUpdateMany).toHaveBeenCalledWith({
      where: { creatorId: "user-1" },
      data: { visibility: "PRIVATE" },
    });
  });

  it("should redact all comments", async () => {
    await repo.anonymize(mockTx, "user-1");

    expect(mockCommentUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { content: "[Commentaire supprimé]" },
    });
  });

  it("should anonymize phone numbers in calls", async () => {
    await repo.anonymize(mockTx, "user-1");

    expect(mockCallUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { phoneNumber: "[ANONYMISÉ]" },
    });
  });

  it("should perform all operations (no partial execution)", async () => {
    await repo.anonymize(mockTx, "user-1");

    expect(mockProfileUpsert).toHaveBeenCalledTimes(1);
    expect(mockUserUpdate).toHaveBeenCalledTimes(1);
    expect(mockScenarioUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockCommentUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockCallUpdateMany).toHaveBeenCalledTimes(1);
  });
});
