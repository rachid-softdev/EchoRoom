import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// PrismaCommentRepository tests
// ---------------------------------------------------------------------------
// Tests for commentRepository.ts:
//   - findById: lookup comment by primary key
//   - updateModerationStatus: update single comment status
//   - updateModerationStatusBulk: update multiple comments (APPROVED / no match)
//   - findPendingQueue: paginated pending comments

describe("PrismaCommentRepository — findById", () => {
  let mockFindUnique: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockFindUnique = vi.fn();
    mockDb = { comment: { findUnique: mockFindUnique } as any };
    const { PrismaCommentRepository } = await import("../commentRepository");
    repo = new PrismaCommentRepository(mockDb as PrismaClient);
  });

  it("should return a comment when found by id", async () => {
    const comment = {
      id: "comment-1",
      userId: "user-1",
      scenarioId: "scenario-1",
      content: "Hello",
      moderationStatus: "PENDING",
      moderatedById: null,
      moderatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockFindUnique.mockResolvedValue(comment);

    const result = await repo.findById("comment-1");

    expect(result).toEqual(comment);
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "comment-1" } });
  });

  it("should return null when comment not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await repo.findById("nonexistent");

    expect(result).toBeNull();
  });
});

describe("PrismaCommentRepository — updateModerationStatus", () => {
  let mockUpdate: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockUpdate = vi.fn();
    mockDb = { comment: { update: mockUpdate } as any };
    const { PrismaCommentRepository } = await import("../commentRepository");
    repo = new PrismaCommentRepository(mockDb as PrismaClient);
  });

  it("should update moderation status, moderatedById, and moderatedAt", async () => {
    mockUpdate.mockResolvedValue({ id: "comment-1" });

    await repo.updateModerationStatus("comment-1", "APPROVED", "moderator-1");

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "comment-1" },
      data: {
        moderationStatus: "APPROVED",
        moderatedById: "moderator-1",
        moderatedAt: expect.any(Date),
      },
    });
  });

  it("should handle REJECTED status", async () => {
    mockUpdate.mockResolvedValue({ id: "comment-2" });

    await repo.updateModerationStatus("comment-2", "REJECTED", "moderator-2");

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "comment-2" },
      data: {
        moderationStatus: "REJECTED",
        moderatedById: "moderator-2",
        moderatedAt: expect.any(Date),
      },
    });
  });

  it("should handle PENDING status (reversion)", async () => {
    mockUpdate.mockResolvedValue({ id: "comment-3" });

    await repo.updateModerationStatus("comment-3", "PENDING", "moderator-3");

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "comment-3" },
      data: {
        moderationStatus: "PENDING",
        moderatedById: "moderator-3",
        moderatedAt: expect.any(Date),
      },
    });
  });
});

describe("PrismaCommentRepository — updateModerationStatusBulk", () => {
  let mockUpdateMany: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockUpdateMany = vi.fn();
    mockDb = { comment: { updateMany: mockUpdateMany } as any };
    const { PrismaCommentRepository } = await import("../commentRepository");
    repo = new PrismaCommentRepository(mockDb as PrismaClient);
  });

  it("should update multiple comments and return count", async () => {
    mockUpdateMany.mockResolvedValue({ count: 3 });

    const count = await repo.updateModerationStatusBulk(
      { id: "comment-1", moderationStatus: "PENDING" },
      { moderationStatus: "APPROVED" },
    );

    expect(count).toBe(3);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "comment-1", moderationStatus: "PENDING" },
      data: { moderationStatus: "APPROVED" },
    });
  });

  it("should return 0 when no comments match", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });

    const count = await repo.updateModerationStatusBulk(
      { id: "nonexistent", moderationStatus: "PENDING" },
      { moderationStatus: "APPROVED" },
    );

    expect(count).toBe(0);
  });

  it("should work without moderationStatus filter", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const count = await repo.updateModerationStatusBulk(
      { id: "comment-1" },
      { moderationStatus: "APPROVED" },
    );

    expect(count).toBe(1);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "comment-1" },
      data: { moderationStatus: "APPROVED" },
    });
  });
});

describe("PrismaCommentRepository — findPendingQueue", () => {
  let mockFindMany: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockFindMany = vi.fn();
    mockDb = { comment: { findMany: mockFindMany } as any };
    const { PrismaCommentRepository } = await import("../commentRepository");
    repo = new PrismaCommentRepository(mockDb as PrismaClient);
  });

  it("should return pending comments with pagination", async () => {
    const comments = [
      {
        id: "c1",
        content: "Pending comment 1",
        moderationStatus: "PENDING",
        userId: "user-1",
        scenarioId: "s1",
        createdAt: new Date(),
        updatedAt: new Date(),
        moderatedById: null,
        moderatedAt: null,
        user: { id: "user-1", username: "alice", image: null },
        scenario: { id: "s1", title: "Test Scenario" },
      },
    ];
    mockFindMany.mockResolvedValue(comments);

    const result = await repo.findPendingQueue(20);

    expect(result).toEqual(comments);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { moderationStatus: "PENDING" },
      take: 21, // limit + 1
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, username: true, image: true } },
        scenario: { select: { id: true, title: true } },
      },
    });
  });

  it("should use cursor-based pagination", async () => {
    mockFindMany.mockResolvedValue([]);

    await repo.findPendingQueue(10, "c5");

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 1,
        cursor: { id: "c5" },
        take: 11,
      }),
    );
  });

  it("should accept a custom status filter", async () => {
    mockFindMany.mockResolvedValue([]);

    await repo.findPendingQueue(10, undefined, "APPROVED");

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { moderationStatus: "APPROVED" },
      }),
    );
  });

  it("should default to PENDING when no status provided", async () => {
    mockFindMany.mockResolvedValue([]);

    await repo.findPendingQueue(5);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { moderationStatus: "PENDING" },
      }),
    );
  });

  it("should return empty array when no pending comments exist", async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await repo.findPendingQueue(20);

    expect(result).toEqual([]);
  });
});
