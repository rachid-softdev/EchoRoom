import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Leaderboard tests: getTopScenarios & getTopCreators
// ---------------------------------------------------------------------------
// Tests for leaderboard.ts:
//   - getTopScenarios: filters by period and visibility/moderation, sorts correctly
//   - getTopCreators: filters by period, sorts correctly
//
// Both functions query the database directly without transactions.

vi.mock("@/server/db", () => ({
  db: {
    scenario: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
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

  it("should return creators sorted by totalLikesReceived descending when sort is LIKES", async () => {
    const { db } = await import("@/server/db");
    const mockCreators = [
      { id: "u1", username: "creator1", totalLikesReceived: 200, totalCallsMade: 50 },
      { id: "u2", username: "creator2", totalLikesReceived: 100, totalCallsMade: 300 },
    ];
    (db.user.findMany as any).mockResolvedValue(mockCreators);

    const { getTopCreators } = await import("../leaderboard");
    const result = await getTopCreators({ period: "ALL", sort: "LIKES" });

    expect(result).toEqual(mockCreators);
    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { totalLikesReceived: "desc" },
      }),
    );
  });

  it("should return creators sorted by totalCallsMade descending when sort is CALLS", async () => {
    const { db } = await import("@/server/db");
    (db.user.findMany as any).mockResolvedValue([]);

    const { getTopCreators } = await import("../leaderboard");
    await getTopCreators({ period: "ALL", sort: "CALLS" });

    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { totalCallsMade: "desc" },
      }),
    );
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
    (db.user.findMany as any).mockResolvedValue([]);

    const { getTopCreators } = await import("../leaderboard");
    await getTopCreators({ period: "ALL", sort: "LIKES" });

    const callArgs = (db.user.findMany as any).mock.calls[0][0];
    // No scenarios filter when period is ALL
    expect(callArgs.where.scenarios).toBeUndefined();
  });

  it("should limit results to 20", async () => {
    const { db } = await import("@/server/db");
    (db.user.findMany as any).mockResolvedValue([]);

    const { getTopCreators } = await import("../leaderboard");
    await getTopCreators({ period: "ALL", sort: "LIKES" });

    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    );
  });

  it("should select the correct fields including _count for scenarios", async () => {
    const { db } = await import("@/server/db");
    (db.user.findMany as any).mockResolvedValue([]);

    const { getTopCreators } = await import("../leaderboard");
    await getTopCreators({ period: "ALL", sort: "LIKES" });

    const callArgs = (db.user.findMany as any).mock.calls[0][0];
    expect(callArgs.select).toBeDefined();
    expect(callArgs.select.id).toBe(true);
    expect(callArgs.select.username).toBe(true);
    expect(callArgs.select.image).toBe(true);
    expect(callArgs.select.totalLikesReceived).toBe(true);
    expect(callArgs.select.totalCallsMade).toBe(true);
    expect(callArgs.select._count).toBeDefined();
    expect(callArgs.select._count.select.scenarios).toBe(true);
  });

  it("should handle empty results gracefully", async () => {
    const { db } = await import("@/server/db");
    (db.user.findMany as any).mockResolvedValue([]);

    const { getTopCreators } = await import("../leaderboard");
    const result = await getTopCreators({ period: "ALL", sort: "LIKES" });

    expect(result).toEqual([]);
  });
});
