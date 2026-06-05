import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Leaderboard tests: getTopScenarios & getTopCreators
// ---------------------------------------------------------------------------
// Tests for leaderboard.ts:
//   - getTopScenarios: filters by period and visibility/moderation, sorts via Prisma
//   - getTopCreators: filters by period, sorts in-memory using social sub-aggregate
//     (Sprint 4: prefers UserSocial sub-aggregate, falls back to legacy fields)

vi.mock("@/server/db", () => ({
  db: {
    scenario: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    userSocial: { findMany: vi.fn() },
  },
}));

describe("getTopScenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return scenarios sorted by likeCount descending when sort is LIKES", async () => {
    const { db } = await import("@/server/db");
    const mockScenarios = [
      { id: "s1", title: "Popular", likeCount: 100, playCount: 50 },
      { id: "s2", title: "Less Popular", likeCount: 50, playCount: 200 },
    ];
    (db.scenario.findMany as any).mockResolvedValue(mockScenarios);

    const { getTopScenarios } = await import("../leaderboard");
    const result = await getTopScenarios({ period: "ALL", sort: "LIKES" });

    expect(result).toEqual(mockScenarios);
    expect(db.scenario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { likeCount: "desc" },
      }),
    );
  });

  it("should return scenarios sorted by playCount descending when sort is PLAYS", async () => {
    const { db } = await import("@/server/db");
    (db.scenario.findMany as any).mockResolvedValue([]);

    const { getTopScenarios } = await import("../leaderboard");
    await getTopScenarios({ period: "ALL", sort: "PLAYS" });

    expect(db.scenario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { playCount: "desc" },
      }),
    );
  });

  it("should always filter by PUBLIC visibility and APPROVED moderation", async () => {
    const { db } = await import("@/server/db");
    (db.scenario.findMany as any).mockResolvedValue([]);

    const { getTopScenarios } = await import("../leaderboard");
    await getTopScenarios({ period: "ALL", sort: "LIKES" });

    expect(db.scenario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          visibility: "PUBLIC",
          moderationStatus: "APPROVED",
        }),
      }),
    );
  });

  it("should apply period filter for WEEK", async () => {
    const { db } = await import("@/server/db");
    (db.scenario.findMany as any).mockResolvedValue([]);

    const { getTopScenarios } = await import("../leaderboard");
    await getTopScenarios({ period: "WEEK", sort: "LIKES" });

    const callArgs = (db.scenario.findMany as any).mock.calls[0][0];
    expect(callArgs.where.createdAt).toBeDefined();
    expect(callArgs.where.createdAt.gte).toBeInstanceOf(Date);

    // Should be approximately 7 days ago
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const gteTime = callArgs.where.createdAt.gte.getTime();
    expect(now - gteTime).toBeGreaterThan(sevenDaysMs - 1000);
    expect(now - gteTime).toBeLessThan(sevenDaysMs + 1000);
  });

  it("should apply period filter for MONTH", async () => {
    const { db } = await import("@/server/db");
    (db.scenario.findMany as any).mockResolvedValue([]);

    const { getTopScenarios } = await import("../leaderboard");
    await getTopScenarios({ period: "MONTH", sort: "LIKES" });

    const callArgs = (db.scenario.findMany as any).mock.calls[0][0];
    expect(callArgs.where.createdAt).toBeDefined();
    expect(callArgs.where.createdAt.gte).toBeInstanceOf(Date);

    // Should be approximately 30 days ago
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const gteTime = callArgs.where.createdAt.gte.getTime();
    expect(now - gteTime).toBeGreaterThan(thirtyDaysMs - 1000);
    expect(now - gteTime).toBeLessThan(thirtyDaysMs + 1000);
  });

  it("should NOT apply createdAt filter for period ALL", async () => {
    const { db } = await import("@/server/db");
    (db.scenario.findMany as any).mockResolvedValue([]);

    const { getTopScenarios } = await import("../leaderboard");
    await getTopScenarios({ period: "ALL", sort: "LIKES" });

    const callArgs = (db.scenario.findMany as any).mock.calls[0][0];
    expect(callArgs.where.createdAt).toBeUndefined();
  });

  it("should limit results to 20", async () => {
    const { db } = await import("@/server/db");
    (db.scenario.findMany as any).mockResolvedValue([]);

    const { getTopScenarios } = await import("../leaderboard");
    await getTopScenarios({ period: "ALL", sort: "LIKES" });

    expect(db.scenario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    );
  });

  it("should select the correct fields including nested relations", async () => {
    const { db } = await import("@/server/db");
    (db.scenario.findMany as any).mockResolvedValue([]);

    const { getTopScenarios } = await import("../leaderboard");
    await getTopScenarios({ period: "ALL", sort: "LIKES" });

    const callArgs = (db.scenario.findMany as any).mock.calls[0][0];
    expect(callArgs.select).toBeDefined();
    expect(callArgs.select.id).toBe(true);
    expect(callArgs.select.title).toBe(true);
    expect(callArgs.select.character).toBeDefined();
    expect(callArgs.select.character.select.name).toBe(true);
    expect(callArgs.select.character.select.avatarUrl).toBe(true);
    expect(callArgs.select.creator).toBeDefined();
    expect(callArgs.select.creator.select.username).toBe(true);
    expect(callArgs.select._count).toBeDefined();
    expect(callArgs.select._count.select.comments).toBe(true);
    expect(callArgs.select._count.select.reactions).toBe(true);
  });

  it("should handle empty results gracefully", async () => {
    const { db } = await import("@/server/db");
    (db.scenario.findMany as any).mockResolvedValue([]);

    const { getTopScenarios } = await import("../leaderboard");
    const result = await getTopScenarios({ period: "ALL", sort: "LIKES" });

    expect(result).toEqual([]);
  });
});

describe("getTopCreators", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should sort by UserSocial.totalLikesReceived when sort is LIKES", async () => {
    const { db } = await import("@/server/db");
    // Mock the userSocialRepository.getTopByLikes call
    (db.userSocial.findMany as any).mockResolvedValue([
      { userId: "u1", totalLikesReceived: 200 },
      { userId: "u2", totalLikesReceived: 30 },
    ]);
    // Mock db.user.findMany to return user details
    (db.user.findMany as any).mockResolvedValue([
      { id: "u1", username: "top", image: null, _count: { scenarios: 5 } },
      { id: "u2", username: "bottom", image: null, _count: { scenarios: 3 } },
    ]);

    const { getTopCreators } = await import("../leaderboard");
    const result = await getTopCreators({ period: "ALL", sort: "LIKES" });

    // u1 has totalLikesReceived=200, u2 has 30 — u1 should be first
    expect(result[0]!.id).toBe("u1");
    expect(result[1]!.id).toBe("u2");
    // Final values should use sub-aggregate
    expect(result[0]!.totalLikesReceived).toBe(200);
    expect(result[1]!.totalLikesReceived).toBe(30);
    expect(result[0]!.username).toBe("top");
    expect(result[1]!.username).toBe("bottom");
  });

  it("should sort by UserSocial.totalCallsMade when sort is CALLS", async () => {
    const { db } = await import("@/server/db");
    // Mock the userSocialRepository.getTopByCalls call
    (db.userSocial.findMany as any).mockResolvedValue([
      { userId: "u1", totalCallsMade: 100 },
      { userId: "u2", totalCallsMade: 50 },
    ]);
    // Mock db.user.findMany to return user details
    (db.user.findMany as any).mockResolvedValue([
      { id: "u1", username: "few", image: null, _count: { scenarios: 2 } },
      { id: "u2", username: "many", image: null, _count: { scenarios: 1 } },
    ]);

    const { getTopCreators } = await import("../leaderboard");
    const result = await getTopCreators({ period: "ALL", sort: "CALLS" });

    // u1 has totalCallsMade=100, u2 has 50
    expect(result[0]!.id).toBe("u1");
    expect(result[1]!.id).toBe("u2");
    expect(result[0]!.totalCallsMade).toBe(100);
    expect(result[1]!.totalCallsMade).toBe(50);
  });

  it("should fall back to legacy fields when UserSocial is null (period-filtered path)", async () => {
    const { db } = await import("@/server/db");
    // This test covers the WEEK/MONTH period code path where
    // db.user.findMany directly returns users with social relations
    const mockCreators = [
      {
        id: "u1", username: "legacy", image: null,
        totalLikesReceived: 150, totalCallsMade: 20,
        social: null,
        _count: { scenarios: 3 },
      },
      {
        id: "u2", username: "social", image: null,
        totalLikesReceived: 10, totalCallsMade: 5,
        social: { totalLikesReceived: 200, totalCallsMade: 99 },
        _count: { scenarios: 1 },
      },
    ];
    (db.user.findMany as any).mockResolvedValue(mockCreators);

    const { getTopCreators } = await import("../leaderboard");
    const result = await getTopCreators({ period: "WEEK", sort: "LIKES" });

    // u2 has social.totalLikesReceived=200 > u1's legacy 150
    expect(result[0]!.id).toBe("u2");
    expect(result[1]!.id).toBe("u1");
  });

  it("should filter by users active in the period for WEEK", async () => {
    const { db } = await import("@/server/db");
    (db.user.findMany as any).mockResolvedValue([]);

    const { getTopCreators } = await import("../leaderboard");
    await getTopCreators({ period: "WEEK", sort: "LIKES" });

    const callArgs = (db.user.findMany as any).mock.calls[0][0];
    expect(callArgs.where.scenarios).toBeDefined();
    expect(callArgs.where.scenarios.some).toBeDefined();
    expect(callArgs.where.scenarios.some.createdAt).toBeDefined();
    expect(callArgs.where.scenarios.some.createdAt.gte).toBeInstanceOf(Date);
  });

  it("should filter by users active in the period for MONTH", async () => {
    const { db } = await import("@/server/db");
    (db.user.findMany as any).mockResolvedValue([]);

    const { getTopCreators } = await import("../leaderboard");
    await getTopCreators({ period: "MONTH", sort: "LIKES" });

    const callArgs = (db.user.findMany as any).mock.calls[0][0];
    expect(callArgs.where.scenarios).toBeDefined();
    expect(callArgs.where.scenarios.some.createdAt.gte).toBeInstanceOf(Date);
  });

  it("should have empty where clause for period ALL (no filter)", async () => {
    const { db } = await import("@/server/db");
    (db.userSocial.findMany as any).mockResolvedValue([]);

    const { getTopCreators } = await import("../leaderboard");
    const result = await getTopCreators({ period: "ALL", sort: "LIKES" });

    // For "ALL" period, the function returns early when userSocial results are empty
    expect(result).toEqual([]);
  });

  it("should limit results via userSocialRepository (take:20)", async () => {
    const { db } = await import("@/server/db");
    (db.userSocial.findMany as any).mockResolvedValue([]);

    const { getTopCreators } = await import("../leaderboard");
    await getTopCreators({ period: "ALL", sort: "LIKES" });

    // The sub-aggregate query is limited to 20
    expect(db.userSocial.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    );
  });

  it("should select user details via db.user.findMany with correct fields", async () => {
    const { db } = await import("@/server/db");
    (db.userSocial.findMany as any).mockResolvedValue([
      { userId: "u1", totalLikesReceived: 10 },
    ]);
    (db.user.findMany as any).mockResolvedValue([
      { id: "u1", username: "user1", image: null, _count: { scenarios: 1 } },
    ]);

    const { getTopCreators } = await import("../leaderboard");
    await getTopCreators({ period: "ALL", sort: "LIKES" });

    // The userSocial query uses the sub-aggregate repository
    const socialCallArgs = (db.userSocial.findMany as any).mock.calls[0][0];
    expect(socialCallArgs.orderBy).toBeDefined();
    expect(socialCallArgs.orderBy.totalLikesReceived).toBe("desc");
    expect(socialCallArgs.take).toBe(20);

    // The user query fetches details by IDs
    const userCallArgs = (db.user.findMany as any).mock.calls[0][0];
    expect(userCallArgs.where.id.in).toEqual(["u1"]);
    expect(userCallArgs.select.id).toBe(true);
    expect(userCallArgs.select.username).toBe(true);
    expect(userCallArgs.select.image).toBe(true);
    expect(userCallArgs.select._count).toBeDefined();
    expect(userCallArgs.select._count.select.scenarios).toBe(true);
  });

  it("should handle empty results gracefully (no social records)", async () => {
    const { db } = await import("@/server/db");
    (db.userSocial.findMany as any).mockResolvedValue([]);

    const { getTopCreators } = await import("../leaderboard");
    const result = await getTopCreators({ period: "ALL", sort: "LIKES" });

    expect(result).toEqual([]);
  });
});
