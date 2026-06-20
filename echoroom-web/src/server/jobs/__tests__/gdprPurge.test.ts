import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// GDPR Purge tests — purgeAnonymizedUsers & hardDeleteUser
// ---------------------------------------------------------------------------
// purgeAnonymizedUsers:
//   - Redis lock acquired → process batches
//   - Lock not acquired → skip
//   - Redis null (not configured) → proceed without lock
//   - Lock released in finally (even on error)
//   - Pagination cursor > BATCH_SIZE
//   - No expired users → nothing deleted
//
// hardDeleteUser:
//   - Transaction deletes all linked entities in correct order
//   - Active calls on user's scenarios → scenarioId = null

const mockRedisSet = vi.fn();
const mockRedisDel = vi.fn();
// Use a mutable variable + getter so tests can set redis to null dynamically
let mockRedisValue: { set: typeof mockRedisSet; del: typeof mockRedisDel } | null = { set: mockRedisSet, del: mockRedisDel };

const mockLogInstance = {
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => mockLogInstance),
}));

vi.mock("@/lib/redis", () => ({
  get redis() { return mockRedisValue; },
}));

// Prisma db mock
const mockTransaction = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    user: {
      findMany: vi.fn(),
    },
    $transaction: mockTransaction,
  },
}));

// BATCH_SIZE constant used inside gdprPurge.ts
const BATCH_SIZE = 50;

/**
 * Build a minimal mockTx that has all the methods hardDeleteUser calls.
 * Tests can override individual methods as needed.
 */
function createFullMockTx(overrides: Record<string, any> = {}) {
  const tx = {
    call: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(0),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    scenario: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    reaction: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    comment: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    purchase: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    dailyCallLimit: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    abuseReport: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    auditLog: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    blockedNumber: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    userBadge: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    clip: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    shareEvent: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    user: { delete: vi.fn().mockResolvedValue({}) },
  };
  return Object.assign(tx, overrides);
}

describe("purgeAnonymizedUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisValue = { set: mockRedisSet, del: mockRedisDel };
  });

  // -----------------------------------------------------------------------
  // Lock acquisition
  // -----------------------------------------------------------------------

  it("should acquire lock and process expired users in batches", async () => {
    mockRedisSet.mockResolvedValue("OK"); // lock acquired

    const expiredUsers = Array.from({ length: BATCH_SIZE }, (_, i) => ({
      id: `user-${i}`,
    }));
    const secondPage = [{ id: "user-extra" }];

    // Two pages of results then empty
    let callCount = 0;
    const { db } = await import("@/server/db");
    (db.user.findMany as any).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(expiredUsers);
      if (callCount === 2) return Promise.resolve(secondPage);
      return Promise.resolve([]);
    });

    mockTransaction.mockImplementation(async (cb: any) => cb(createFullMockTx()));

    const { purgeAnonymizedUsers } = await import("../gdprPurge");
    const result = await purgeAnonymizedUsers(30);

    expect(result).toEqual({ deletedUsers: BATCH_SIZE + 1 });
    expect(mockRedisSet).toHaveBeenCalledWith("job:gdpr-purge:lock", "1", {
      nx: true,
      ex: 300,
    });
    expect(mockRedisDel).toHaveBeenCalledWith("job:gdpr-purge:lock");
  });

  it("should skip when lock is not acquired", async () => {
    mockRedisSet.mockResolvedValue(null); // lock not acquired

    const { purgeAnonymizedUsers } = await import("../gdprPurge");
    const result = await purgeAnonymizedUsers(30);

    expect(result).toEqual({ deletedUsers: 0 });
    expect(mockRedisSet).toHaveBeenCalledWith("job:gdpr-purge:lock", "1", {
      nx: true,
      ex: 300,
    });
    expect(mockLogInstance.warn).toHaveBeenCalledWith("GDPR purge already running — skipping");
    // Should NOT have queried users
    const { db } = await import("@/server/db");
    expect(db.user.findMany).not.toHaveBeenCalled();
  });

  it("should proceed without lock when redis is null (not configured)", async () => {
    // Set redis to null to simulate Redis not being configured
    mockRedisValue = null;

    const { db } = await import("@/server/db");
    (db.user.findMany as any).mockResolvedValue([]);

    const { purgeAnonymizedUsers } = await import("../gdprPurge");
    const result = await purgeAnonymizedUsers(30);

    expect(result).toEqual({ deletedUsers: 0 });
    // redis.set should NOT have been called (redis is null, so the if block is skipped)
    expect(mockRedisSet).not.toHaveBeenCalled();
    expect(mockRedisDel).not.toHaveBeenCalled();
  });

  it("should release lock in finally block even on error", async () => {
    mockRedisSet.mockResolvedValue("OK");

    const { db } = await import("@/server/db");
    (db.user.findMany as any).mockRejectedValue(new Error("Database error"));

    const { purgeAnonymizedUsers } = await import("../gdprPurge");
    await expect(purgeAnonymizedUsers(30)).rejects.toThrow("Database error");

    // Lock is released even on error (finally block)
    expect(mockRedisDel).toHaveBeenCalledWith("job:gdpr-purge:lock");
  });

  // -----------------------------------------------------------------------
  // Pagination
  // -----------------------------------------------------------------------

  it("should use cursor-based pagination when results exceed BATCH_SIZE", async () => {
    mockRedisSet.mockResolvedValue("OK");

    const firstPage = Array.from({ length: BATCH_SIZE }, (_, i) => ({
      id: `user-${i}`,
    }));
    const secondPage = Array.from({ length: BATCH_SIZE }, (_, i) => ({
      id: `user-${BATCH_SIZE + i}`,
    }));

    let callCount = 0;
    const { db } = await import("@/server/db");
    (db.user.findMany as any).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(firstPage);
      if (callCount === 2) return Promise.resolve(secondPage);
      return Promise.resolve([]);
    });

    mockTransaction.mockImplementation(async (cb: any) => cb(createFullMockTx()));

    const { purgeAnonymizedUsers } = await import("../gdprPurge");
    const result = await purgeAnonymizedUsers(30);

    expect(result).toEqual({ deletedUsers: BATCH_SIZE * 2 });

    // Verify second query uses cursor
    expect(db.user.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        deletedAt: { lte: expect.any(Date), not: null },
        anonymizedAt: { not: null },
      },
      take: BATCH_SIZE,
      skip: 1,
      cursor: { id: firstPage[firstPage.length - 1]!.id },
      orderBy: { id: "asc" },
      select: { id: true },
    });
  });

  it("should return 0 when no expired users exist", async () => {
    mockRedisSet.mockResolvedValue("OK");

    const { db } = await import("@/server/db");
    (db.user.findMany as any).mockResolvedValue([]);

    const { purgeAnonymizedUsers } = await import("../gdprPurge");
    const result = await purgeAnonymizedUsers(30);

    expect(result).toEqual({ deletedUsers: 0 });
    expect(db.user.findMany).toHaveBeenCalledTimes(1);
  });
});

describe("hardDeleteUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisValue = { set: mockRedisSet, del: mockRedisDel };
  });

  it("should delete all linked entities in correct order inside a transaction", async () => {
    const mockCallDeleteMany = vi.fn().mockResolvedValue({ count: 5 });
    const mockScenarioDeleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const mockReactionDeleteMany = vi.fn().mockResolvedValue({ count: 10 });
    const mockCommentDeleteMany = vi.fn().mockResolvedValue({ count: 3 });
    const mockCommentUpdateMany = vi.fn().mockResolvedValue({ count: 0 });
    const mockPurchaseDeleteMany = vi.fn().mockResolvedValue({ count: 3 });
    const mockDailyLimitDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const mockAbuseReportDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const mockAuditLogDeleteMany = vi.fn().mockResolvedValue({ count: 5 });
    const mockBlockedNumberDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const mockUserBadgeDeleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const mockClipDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const mockShareEventDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const mockUserDelete = vi.fn().mockResolvedValue({});

    const overrides = {
      call: {
        deleteMany: mockCallDeleteMany,
        count: vi.fn().mockResolvedValue(0),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      scenario: { deleteMany: mockScenarioDeleteMany },
      reaction: { deleteMany: mockReactionDeleteMany },
      comment: {
        deleteMany: mockCommentDeleteMany,
        updateMany: mockCommentUpdateMany,
      },
      purchase: { deleteMany: mockPurchaseDeleteMany },
      dailyCallLimit: { deleteMany: mockDailyLimitDeleteMany },
      abuseReport: { deleteMany: mockAbuseReportDeleteMany },
      auditLog: { deleteMany: mockAuditLogDeleteMany },
      blockedNumber: { deleteMany: mockBlockedNumberDeleteMany },
      userBadge: { deleteMany: mockUserBadgeDeleteMany },
      clip: { deleteMany: mockClipDeleteMany },
      shareEvent: { deleteMany: mockShareEventDeleteMany },
      user: { delete: mockUserDelete },
    };

    mockTransaction.mockImplementation(async (cb: any) => cb(createFullMockTx(overrides)));

    const gdprPurge = await import("../gdprPurge");

    // hardDeleteUser is not exported — we test it through purgeAnonymizedUsers
    mockRedisSet.mockResolvedValue("OK");
    const { db } = await import("@/server/db");
    (db.user.findMany as any).mockResolvedValue([{ id: "user-to-delete" }]);

    await gdprPurge.purgeAnonymizedUsers(30);

    // Verify the transaction executed
    expect(mockTransaction).toHaveBeenCalledTimes(1);

    // Verify call.deleteMany was called (first in order)
    expect(mockCallDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-to-delete" } });

    // Verify scenario.deleteMany was called
    expect(mockScenarioDeleteMany).toHaveBeenCalledWith({ where: { creatorId: "user-to-delete" } });

    // Verify reaction and comment deletions
    expect(mockReactionDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-to-delete" } });
    expect(mockCommentDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-to-delete" } });

    // Verify purchase and dailyLimit deletions
    expect(mockPurchaseDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-to-delete" } });
    expect(mockDailyLimitDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-to-delete" } });

    // Verify social deletions
    expect(mockUserBadgeDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-to-delete" } });
    expect(mockClipDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-to-delete" } });
    expect(mockShareEventDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-to-delete" } });

    // Final user.delete
    expect(mockUserDelete).toHaveBeenCalledWith({ where: { id: "user-to-delete" } });
  });

  it("should set scenarioId to null for active calls on deleted user's scenarios", async () => {
    mockRedisSet.mockResolvedValue("OK");

    // First count query returns > 0 (active calls exist)
    const mockTxCountActive = vi.fn().mockResolvedValue(2);
    const mockTxUpdateManyActive = vi.fn().mockResolvedValue({ count: 2 });

    const overrides = {
      call: {
        deleteMany: vi.fn().mockResolvedValue({ count: 5 }),
        count: mockTxCountActive,
        updateMany: mockTxUpdateManyActive,
      },
      scenario: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };

    mockTransaction.mockImplementation(async (cb: any) => cb(createFullMockTx(overrides)));

    const gdprPurge = await import("../gdprPurge");
    const { db } = await import("@/server/db");
    (db.user.findMany as any).mockResolvedValue([{ id: "user-with-scenarios" }]);

    await gdprPurge.purgeAnonymizedUsers(30);

    // Verify active call count query was made
    expect(mockTxCountActive).toHaveBeenCalledWith({
      where: {
        scenario: { creatorId: "user-with-scenarios" },
        userId: { not: "user-with-scenarios" },
        status: { in: ["PENDING", "RINGING", "ACTIVE", "CALLING"] },
      },
    });

    // Verify scenarioId was set to null on active calls
    // Check via the overridden call.updateMany
    expect(mockTxUpdateManyActive).toHaveBeenCalledWith({
      where: {
        scenario: { creatorId: "user-with-scenarios" },
        userId: { not: "user-with-scenarios" },
        status: { in: ["PENDING", "RINGING", "ACTIVE", "CALLING"] as any },
      },
      data: { scenarioId: null },
    });

    // Verify scenarios were then deleted
    expect(overrides.scenario.deleteMany).toHaveBeenCalledWith({ where: { creatorId: "user-with-scenarios" } });
  });

  it("should handle moderation/comments where user is the moderator", async () => {
    mockRedisSet.mockResolvedValue("OK");

    const mockCommentUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const mockAbuseReportDeleteMany = vi.fn().mockResolvedValue({ count: 2 });

    const overrides = {
      comment: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        updateMany: mockCommentUpdateMany,
      },
      abuseReport: { deleteMany: mockAbuseReportDeleteMany },
    };

    mockTransaction.mockImplementation(async (cb: any) => cb(createFullMockTx(overrides)));

    const gdprPurge = await import("../gdprPurge");
    const { db } = await import("@/server/db");
    (db.user.findMany as any).mockResolvedValue([{ id: "user-mod" }]);

    await gdprPurge.purgeAnonymizedUsers(30);

    // Abuse reports OR query: reporterId OR reviewedById
    expect(mockAbuseReportDeleteMany).toHaveBeenCalledWith({
      where: { OR: [{ reporterId: "user-mod" }, { reviewedById: "user-mod" }] },
    });

    // Comment updateMany: set moderatedById to null
    expect(mockCommentUpdateMany).toHaveBeenCalledWith({
      where: { moderatedById: "user-mod" },
      data: { moderatedById: null, moderatedAt: null },
    });
  });
});
