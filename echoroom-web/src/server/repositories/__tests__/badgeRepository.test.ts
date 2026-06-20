import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// PrismaBadgeRepository tests
// ---------------------------------------------------------------------------
// Tests for badgeRepository.ts:
//   - findCandidateBadges: filter by criteria type
//   - findUserBadge: found / not found
//   - createUserBadge: creates record / duplicate throws
//   - countUserCallsByStatus: count by status
//   - countUserScenarios: count by creatorId
//   - sumLikesReceived: sum likeCount from user's scenarios

describe("PrismaBadgeRepository — findCandidateBadges", () => {
  let mockFindMany: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockFindMany = vi.fn();
    mockDb = { badge: { findMany: mockFindMany } as any };
    const { PrismaBadgeRepository } = await import("../badgeRepository");
    repo = new PrismaBadgeRepository(mockDb as PrismaClient);
  });

  it("should query badges by criteria type using JSON path filter", async () => {
    const badges = [
      { id: "b1", name: "First Call", criteria: { type: "FIRST_CALL" } },
      { id: "b2", name: "Ten Calls", criteria: { type: "TEN_CALLS", threshold: 10 } },
    ];
    mockFindMany.mockResolvedValue(badges);

    const result = await repo.findCandidateBadges(["FIRST_CALL", "TEN_CALLS"]);

    expect(result).toEqual(badges);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { criteria: { path: ["type"], equals: "FIRST_CALL" } },
          { criteria: { path: ["type"], equals: "TEN_CALLS" } },
        ],
      },
    });
  });

  it("should return empty array when no badges match", async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await repo.findCandidateBadges(["UNKNOWN_TYPE"]);

    expect(result).toEqual([]);
  });
});

describe("PrismaBadgeRepository — findUserBadge", () => {
  let mockFindUnique: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockFindUnique = vi.fn();
    mockDb = { userBadge: { findUnique: mockFindUnique } as any };
    const { PrismaBadgeRepository } = await import("../badgeRepository");
    repo = new PrismaBadgeRepository(mockDb as PrismaClient);
  });

  it("should return user badge when found", async () => {
    const userBadge = {
      id: "ub-1",
      userId: "user-1",
      badgeId: "badge-1",
      awardedAt: new Date(),
    };
    mockFindUnique.mockResolvedValue(userBadge);

    const result = await repo.findUserBadge("user-1", "badge-1");

    expect(result).toEqual(userBadge);
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { userId_badgeId: { userId: "user-1", badgeId: "badge-1" } },
    });
  });

  it("should return null when user badge not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await repo.findUserBadge("user-1", "nonexistent-badge");

    expect(result).toBeNull();
  });
});

describe("PrismaBadgeRepository — createUserBadge", () => {
  let mockCreate: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockCreate = vi.fn();
    mockDb = { userBadge: { create: mockCreate } as any };
    const { PrismaBadgeRepository } = await import("../badgeRepository");
    repo = new PrismaBadgeRepository(mockDb as PrismaClient);
  });

  it("should create a user badge record", async () => {
    const created = { id: "ub-1", userId: "user-1", badgeId: "badge-1", awardedAt: new Date() };
    mockCreate.mockResolvedValue(created);

    const result = await repo.createUserBadge("user-1", "badge-1");

    expect(result).toEqual(created);
    expect(mockCreate).toHaveBeenCalledWith({ data: { userId: "user-1", badgeId: "badge-1" } });
  });

  it("should throw on duplicate (unique constraint)", async () => {
    mockCreate.mockRejectedValue(new Error("Unique constraint violation"));

    await expect(
      repo.createUserBadge("user-1", "badge-1"),
    ).rejects.toThrow("Unique constraint violation");
  });
});

describe("PrismaBadgeRepository — countUserCallsByStatus", () => {
  let mockCount: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockCount = vi.fn();
    mockDb = { call: { count: mockCount } as any };
    const { PrismaBadgeRepository } = await import("../badgeRepository");
    repo = new PrismaBadgeRepository(mockDb as PrismaClient);
  });

  it("should count calls by user and status", async () => {
    mockCount.mockResolvedValue(5);

    const result = await repo.countUserCallsByStatus("user-1", "COMPLETED");

    expect(result).toBe(5);
    expect(mockCount).toHaveBeenCalledWith({
      where: { userId: "user-1", status: "COMPLETED" },
    });
  });

  it("should return 0 when user has no matching calls", async () => {
    mockCount.mockResolvedValue(0);

    const result = await repo.countUserCallsByStatus("user-2", "COMPLETED");

    expect(result).toBe(0);
  });

  it("should filter by different status values", async () => {
    mockCount.mockResolvedValue(2);

    await repo.countUserCallsByStatus("user-1", "FAILED");

    expect(mockCount).toHaveBeenCalledWith({
      where: { userId: "user-1", status: "FAILED" },
    });
  });
});

describe("PrismaBadgeRepository — countUserScenarios", () => {
  let mockCount: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockCount = vi.fn();
    mockDb = { scenario: { count: mockCount } as any };
    const { PrismaBadgeRepository } = await import("../badgeRepository");
    repo = new PrismaBadgeRepository(mockDb as PrismaClient);
  });

  it("should count scenarios by creatorId", async () => {
    mockCount.mockResolvedValue(3);

    const result = await repo.countUserScenarios("user-1");

    expect(result).toBe(3);
    expect(mockCount).toHaveBeenCalledWith({
      where: { creatorId: "user-1" },
    });
  });

  it("should return 0 when user has no scenarios", async () => {
    mockCount.mockResolvedValue(0);

    const result = await repo.countUserScenarios("user-no-scenarios");

    expect(result).toBe(0);
  });
});

describe("PrismaBadgeRepository — sumLikesReceived", () => {
  let mockAggregate: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockAggregate = vi.fn();
    mockDb = { scenario: { aggregate: mockAggregate } as any };
    const { PrismaBadgeRepository } = await import("../badgeRepository");
    repo = new PrismaBadgeRepository(mockDb as PrismaClient);
  });

  it("should sum likeCount from user's scenarios", async () => {
    mockAggregate.mockResolvedValue({ _sum: { likeCount: 42 } });

    const result = await repo.sumLikesReceived("user-1");

    expect(result).toBe(42);
    expect(mockAggregate).toHaveBeenCalledWith({
      where: { creatorId: "user-1" },
      _sum: { likeCount: true },
    });
  });

  it("should return 0 when _sum.likeCount is null", async () => {
    mockAggregate.mockResolvedValue({ _sum: { likeCount: null } });

    const result = await repo.sumLikesReceived("user-no-likes");

    expect(result).toBe(0);
  });

  it("should return 0 when user has no scenarios", async () => {
    mockAggregate.mockResolvedValue({ _sum: { likeCount: null } });

    const result = await repo.sumLikesReceived("user-no-scenarios");

    expect(result).toBe(0);
  });
});
