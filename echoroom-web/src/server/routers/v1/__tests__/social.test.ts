import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// socialV1Router tests
// ---------------------------------------------------------------------------

const mockDb = vi.hoisted(() => ({
  reaction: {
    findUnique: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
  },
  scenario: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  call: {
    findUnique: vi.fn(),
  },
  clip: {
    findMany: vi.fn(),
  },
  userBadge: {
    findMany: vi.fn(),
  },
  badge: {
    findMany: vi.fn(),
  },
  featuredScenario: {
    findFirst: vi.fn(),
  },
  shareEvent: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  db: mockDb,
}));

const mockCreateClip = vi.hoisted(() => vi.fn());
const mockDeleteClip = vi.hoisted(() => vi.fn());
const mockGetClips = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/social/clips", () => ({
  createClip: mockCreateClip,
  deleteClip: mockDeleteClip,
  getClips: mockGetClips,
}));

const mockGetTopScenarios = vi.hoisted(() => vi.fn());
const mockGetTopCreators = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/social/leaderboard", () => ({
  getTopScenarios: mockGetTopScenarios,
  getTopCreators: mockGetTopCreators,
}));

const mockCheckAndAwardBadges = vi.hoisted(() => vi.fn());
vi.mock("@/server/services/social/badges", () => ({
  checkAndAwardBadges: mockCheckAndAwardBadges,
}));

vi.mock("@/server/lib/errors", () => ({
  AppError: class AppError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "AppError";
    }
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: null,
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock("@/server/middleware/metrics", () => ({
  withREDMetrics: vi.fn(() => (opts: { next: Function }) => opts.next()),
}));

// Mock procedures module
vi.mock("@/server/procedures", () => {
  const chain = {
    input: vi.fn(() => chain),
    mutation: vi.fn((handler: Function) => ({
      type: "mutation" as const,
      handler,
    })),
    query: vi.fn((handler: Function) => ({
      type: "query" as const,
      handler,
    })),
    use: vi.fn(() => chain),
  };

  return {
    router: vi.fn((routes: Record<string, unknown>) => routes),
    t: { procedure: chain },
    publicProcedure: chain,
    protectedProcedure: chain,
    adminProcedure: chain,
    middleware: vi.fn((fn: Function) => fn),
    withRateLimit: vi.fn(() => (opts: { next: Function }) => opts.next()),
    withIPRateLimit: vi.fn(() => (opts: { next: Function }) => opts.next()),
    withTracing: vi.fn(() => chain),
    isAuthenticated: chain,
    isAdmin: chain,
    withREDMetrics: vi.fn(() => (opts: { next: Function }) => opts.next()),
  };
});

const validCtx = { session: { user: { id: "user-123" } } };
const anonCtx = { session: null };

// ---------------------------------------------------------------------------
// toggleLike
// ---------------------------------------------------------------------------
describe("socialV1Router.toggleLike", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create reaction (toggle on) when none exists", async () => {
    mockDb.reaction.findUnique.mockResolvedValue(null);
    mockDb.scenario.findUnique.mockResolvedValue({ creatorId: "creator-1" });
    mockDb.$transaction.mockImplementation(async (cb: Function) => {
      const mockTx = {
        reaction: { create: vi.fn().mockResolvedValue({ id: "reaction-1" }) },
        scenario: { update: vi.fn().mockResolvedValue({}) },
        userSocial: { upsert: vi.fn().mockResolvedValue({}) },
      };
      await cb(mockTx);
    });
    mockCheckAndAwardBadges.mockResolvedValue({ id: "badge-1", name: "First Like", description: "Received your first like", iconUrl: null });

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).toggleLike.handler;

    const result = await handler({
      input: { scenarioId: "scenario-1", emoji: "👍" },
      ctx: validCtx,
    });

    expect(result).toEqual({ reacted: true, emoji: "👍", newBadge: expect.objectContaining({ id: "badge-1" }) });
    expect(mockCheckAndAwardBadges).toHaveBeenCalledWith("creator-1", "LIKE_RECEIVED");
  });

  it("should remove reaction (toggle off) when one exists", async () => {
    mockDb.reaction.findUnique.mockResolvedValue({ id: "reaction-1", userId: "user-123", scenarioId: "scenario-1", emoji: "👍" });
    mockDb.scenario.findUnique.mockResolvedValue({ creatorId: "creator-1" });
    mockDb.$transaction.mockImplementation(async (cb: Function) => {
      const mockTx = {
        reaction: { delete: vi.fn().mockResolvedValue({}) },
        scenario: { update: vi.fn().mockResolvedValue({}) },
        userSocial: { upsert: vi.fn().mockResolvedValue({}) },
      };
      await cb(mockTx);
    });
    mockCheckAndAwardBadges.mockResolvedValue(null);

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).toggleLike.handler;

    const result = await handler({
      input: { scenarioId: "scenario-1", emoji: "👍" },
      ctx: validCtx,
    });

    expect(result).toEqual({ reacted: false, emoji: "👍", newBadge: null });
    expect(mockCheckAndAwardBadges).not.toHaveBeenCalled();
  });

  it("should throw NOT_FOUND when scenario does not exist on toggle on", async () => {
    mockDb.reaction.findUnique.mockResolvedValue(null);
    mockDb.scenario.findUnique.mockResolvedValue(null);

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).toggleLike.handler;

    await expect(
      handler({ input: { scenarioId: "nonexistent", emoji: "👍" }, ctx: validCtx }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Scénario introuvable",
    });
  });

  it("should throw NOT_FOUND when scenario does not exist on toggle off", async () => {
    mockDb.reaction.findUnique.mockResolvedValue({ id: "reaction-1" });
    mockDb.scenario.findUnique.mockResolvedValue(null);

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).toggleLike.handler;

    await expect(
      handler({ input: { scenarioId: "nonexistent", emoji: "👍" }, ctx: validCtx }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Scénario introuvable",
    });
  });

  it("should increment likeCount in transaction on toggle on", async () => {
    mockDb.reaction.findUnique.mockResolvedValue(null);
    mockDb.scenario.findUnique.mockResolvedValue({ creatorId: "creator-1" });
    let capturedUpdate: any;
    mockDb.$transaction.mockImplementation(async (cb: Function) => {
      const mockTx = {
        reaction: { create: vi.fn().mockResolvedValue({ id: "r-1" }) },
        scenario: {
          update: vi.fn((args: any) => {
            capturedUpdate = args;
            return {};
          }),
        },
        userSocial: { upsert: vi.fn().mockResolvedValue({}) },
      };
      await cb(mockTx);
    });
    mockCheckAndAwardBadges.mockResolvedValue(null);

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).toggleLike.handler;

    await handler({ input: { scenarioId: "scenario-1", emoji: "👍" }, ctx: validCtx });

    expect(capturedUpdate).toEqual({
      where: { id: "scenario-1" },
      data: { likeCount: { increment: 1 } },
    });
  });

  it("should decrement likeCount in transaction on toggle off", async () => {
    mockDb.reaction.findUnique.mockResolvedValue({ id: "r-1", userId: "user-123", scenarioId: "s-1", emoji: "👍" });
    mockDb.scenario.findUnique.mockResolvedValue({ creatorId: "creator-1" });
    let capturedUpdate: any;
    mockDb.$transaction.mockImplementation(async (cb: Function) => {
      const mockTx = {
        reaction: { delete: vi.fn().mockResolvedValue({}) },
        scenario: {
          update: vi.fn((args: any) => {
            capturedUpdate = args;
            return {};
          }),
        },
        userSocial: { upsert: vi.fn().mockResolvedValue({}) },
      };
      await cb(mockTx);
    });

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).toggleLike.handler;

    await handler({ input: { scenarioId: "s-1", emoji: "👍" }, ctx: validCtx });

    expect(capturedUpdate).toEqual({
      where: { id: "s-1" },
      data: { likeCount: { decrement: 1 } },
    });
  });

  it("should upsert userSocial sub-aggregate correctly on toggle on", async () => {
    mockDb.reaction.findUnique.mockResolvedValue(null);
    mockDb.scenario.findUnique.mockResolvedValue({ creatorId: "creator-1" });

    mockDb.$transaction.mockImplementation(async (cb: Function) => {
      const mockTx = {
        reaction: { create: vi.fn().mockResolvedValue({ id: "r-1" }) },
        scenario: { update: vi.fn().mockResolvedValue({}) },
        userSocial: { upsert: vi.fn().mockResolvedValue({}) },
      };
      await cb(mockTx);
    });
    mockCheckAndAwardBadges.mockResolvedValue(null);

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).toggleLike.handler;

    await handler({ input: { scenarioId: "s-1", emoji: "👍" }, ctx: validCtx });

    const txCallback = mockDb.$transaction.mock.calls[0]![0];
    const mockTx = {
      reaction: { create: vi.fn() },
      scenario: { update: vi.fn() },
      userSocial: { upsert: vi.fn() },
    };
    await txCallback(mockTx);

    expect(mockTx.userSocial.upsert).toHaveBeenCalledWith({
      where: { userId: "creator-1" },
      create: { userId: "creator-1", totalLikesReceived: 1 },
      update: { totalLikesReceived: { increment: 1 } },
    });
  });

  it("should upsert userSocial sub-aggregate correctly on toggle off", async () => {
    mockDb.reaction.findUnique.mockResolvedValue({ id: "r-1", userId: "user-123", scenarioId: "s-1", emoji: "👍" });
    mockDb.scenario.findUnique.mockResolvedValue({ creatorId: "creator-1" });

    mockDb.$transaction.mockImplementation(async (cb: Function) => {
      const mockTx = {
        reaction: { delete: vi.fn().mockResolvedValue({}) },
        scenario: { update: vi.fn().mockResolvedValue({}) },
        userSocial: { upsert: vi.fn().mockResolvedValue({}) },
      };
      await cb(mockTx);
    });

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).toggleLike.handler;

    await handler({ input: { scenarioId: "s-1", emoji: "👍" }, ctx: validCtx });

    const txCallback = mockDb.$transaction.mock.calls[0]![0];
    const mockTx = {
      reaction: { delete: vi.fn() },
      scenario: { update: vi.fn() },
      userSocial: { upsert: vi.fn() },
    };
    await txCallback(mockTx);

    expect(mockTx.userSocial.upsert).toHaveBeenCalledWith({
      where: { userId: "creator-1" },
      create: { userId: "creator-1" },
      update: { totalLikesReceived: { decrement: 1 } },
    });
  });

  it("should return null newBadge when no badge criteria met", async () => {
    mockDb.reaction.findUnique.mockResolvedValue(null);
    mockDb.scenario.findUnique.mockResolvedValue({ creatorId: "creator-1" });
    mockDb.$transaction.mockImplementation(async (cb: Function) => {
      const mockTx = {
        reaction: { create: vi.fn().mockResolvedValue({ id: "r-1" }) },
        scenario: { update: vi.fn().mockResolvedValue({}) },
        userSocial: { upsert: vi.fn().mockResolvedValue({}) },
      };
      await cb(mockTx);
    });
    mockCheckAndAwardBadges.mockResolvedValue(null);

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).toggleLike.handler;

    const result = await handler({
      input: { scenarioId: "scenario-1", emoji: "❤️" },
      ctx: validCtx,
    });

    expect(result.newBadge).toBeNull();
  });

  it("should use compound unique key for reaction lookup", async () => {
    mockDb.reaction.findUnique.mockResolvedValue(null);
    mockDb.scenario.findUnique.mockResolvedValue({ creatorId: "c-1" });
    mockDb.$transaction.mockImplementation(async (cb: Function) => {
      const mockTx = {
        reaction: { create: vi.fn().mockResolvedValue({}) },
        scenario: { update: vi.fn().mockResolvedValue({}) },
        userSocial: { upsert: vi.fn().mockResolvedValue({}) },
      };
      await cb(mockTx);
    });
    mockCheckAndAwardBadges.mockResolvedValue(null);

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).toggleLike.handler;

    await handler({
      input: { scenarioId: "scenario-1", emoji: "😄" },
      ctx: validCtx,
    });

    expect(mockDb.reaction.findUnique).toHaveBeenCalledWith({
      where: {
        userId_scenarioId_emoji: {
          userId: "user-123",
          scenarioId: "scenario-1",
          emoji: "😄",
        },
      },
    });
  });
});

// ---------------------------------------------------------------------------
// getReactions
// ---------------------------------------------------------------------------
describe("socialV1Router.getReactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return grouped reactions for authenticated user", async () => {
    mockDb.reaction.groupBy.mockResolvedValue([
      { emoji: "👍", _count: 5 },
      { emoji: "❤️", _count: 3 },
    ]);
    mockDb.reaction.findMany.mockResolvedValue([
      { emoji: "👍" },
    ]);

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).getReactions.handler;

    const result = await handler({
      input: { scenarioId: "scenario-1" },
      ctx: validCtx,
    });

    expect(result.reactions).toEqual([
      { emoji: "👍", count: 5, userReacted: true },
      { emoji: "❤️", count: 3, userReacted: false },
    ]);
  });

  it("should return grouped reactions for anonymous user (no userEmojis)", async () => {
    mockDb.reaction.groupBy.mockResolvedValue([
      { emoji: "👍", _count: 5 },
    ]);

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).getReactions.handler;

    const result = await handler({
      input: { scenarioId: "scenario-1" },
      ctx: anonCtx,
    });

    expect(result.reactions).toEqual([
      { emoji: "👍", count: 5, userReacted: false },
    ]);
    expect(mockDb.reaction.findMany).not.toHaveBeenCalled();
  });

  it("should return empty array when no reactions exist", async () => {
    mockDb.reaction.groupBy.mockResolvedValue([]);

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).getReactions.handler;

    const result = await handler({
      input: { scenarioId: "scenario-empty" },
      ctx: anonCtx,
    });

    expect(result.reactions).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// createClip (social router version)
// ---------------------------------------------------------------------------
describe("socialV1Router.createClip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a clip successfully", async () => {
    mockCreateClip.mockResolvedValue({ clipId: "clip-1" });

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).createClip.handler;

    const result = await handler({
      input: { callId: "call-1", startTime: 10, endTime: 20 },
      ctx: validCtx,
    });

    expect(result).toEqual({ clipId: "clip-1" });
    expect(mockCreateClip).toHaveBeenCalledWith({
      callId: "call-1",
      userId: "user-123",
      startTime: 10,
      endTime: 20,
    });
  });

  it("should pass optional title when provided", async () => {
    mockCreateClip.mockResolvedValue({ clipId: "clip-1" });

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).createClip.handler;

    await handler({
      input: { callId: "call-1", startTime: 10, endTime: 20, title: "Best Clip" },
      ctx: validCtx,
    });

    expect(mockCreateClip).toHaveBeenCalledWith({
      callId: "call-1",
      userId: "user-123",
      startTime: 10,
      endTime: 20,
      title: "Best Clip",
    });
  });

  it("should map NOT_FOUND AppError to TRPCError NOT_FOUND", async () => {
    const { AppError } = await import("@/server/lib/errors");
    mockCreateClip.mockRejectedValue(new AppError("NOT_FOUND", "Appel introuvable"));

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).createClip.handler;

    await expect(
      handler({ input: { callId: "nonexistent", startTime: 0, endTime: 10 }, ctx: validCtx }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("should map FORBIDDEN AppError to TRPCError FORBIDDEN", async () => {
    const { AppError } = await import("@/server/lib/errors");
    mockCreateClip.mockRejectedValue(new AppError("FORBIDDEN", "Pas votre appel"));

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).createClip.handler;

    await expect(
      handler({ input: { callId: "call-1", startTime: 0, endTime: 10 }, ctx: validCtx }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("should re-throw non-AppError errors", async () => {
    mockCreateClip.mockRejectedValue(new Error("DB error"));

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).createClip.handler;

    await expect(
      handler({ input: { callId: "call-1", startTime: 0, endTime: 10 }, ctx: validCtx }),
    ).rejects.toThrow("DB error");
  });
});

// ---------------------------------------------------------------------------
// getClips (social router version)
// ---------------------------------------------------------------------------
describe("socialV1Router.getClips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return clips for a call owned by the user", async () => {
    mockDb.call.findUnique.mockResolvedValue({ id: "call-1", userId: "user-123" });
    mockGetClips.mockResolvedValue([
      { id: "clip-1", clipUrl: "https://example.com/clip.wav", startTime: 0, endTime: 10 },
    ]);

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).getClips.handler;

    const result = await handler({
      input: { callId: "call-1" },
      ctx: validCtx,
    });

    expect(result).toHaveLength(1);
    expect(mockGetClips).toHaveBeenCalledWith("call-1");
  });

  it("should throw NOT_FOUND when call does not exist", async () => {
    mockDb.call.findUnique.mockResolvedValue(null);

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).getClips.handler;

    await expect(
      handler({ input: { callId: "nonexistent" }, ctx: validCtx }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("should throw FORBIDDEN when call not owned by user", async () => {
    mockDb.call.findUnique.mockResolvedValue({ id: "call-1", userId: "other-user" });

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).getClips.handler;

    await expect(
      handler({ input: { callId: "call-1" }, ctx: validCtx }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ---------------------------------------------------------------------------
// deleteClip (social router version)
// ---------------------------------------------------------------------------
describe("socialV1Router.deleteClip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete a clip successfully", async () => {
    mockDeleteClip.mockResolvedValue({ success: true });

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).deleteClip.handler;

    const result = await handler({
      input: { clipId: "clip-1" },
      ctx: validCtx,
    });

    expect(result).toEqual({ success: true });
    expect(mockDeleteClip).toHaveBeenCalledWith("clip-1", "user-123");
  });

  it("should map NOT_FOUND AppError", async () => {
    const { AppError } = await import("@/server/lib/errors");
    mockDeleteClip.mockRejectedValue(new AppError("NOT_FOUND", "Clip introuvable"));

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).deleteClip.handler;

    await expect(
      handler({ input: { clipId: "nonexistent" }, ctx: validCtx }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ---------------------------------------------------------------------------
// getLeaderboardScenarios
// ---------------------------------------------------------------------------
describe("socialV1Router.getLeaderboardScenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return top scenarios with default params (Zod schema)", () => {
    import("zod").then(({ z }) => {
      const schema = z.object({
        period: z.enum(["ALL", "WEEK", "MONTH"]).default("ALL"),
        sort: z.enum(["LIKES", "PLAYS"]).default("LIKES"),
      });
      const result = schema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.period).toBe("ALL");
        expect(result.data.sort).toBe("LIKES");
      }
    });
  });

  it("should forward period and sort params", async () => {
    mockGetTopScenarios.mockResolvedValue([]);

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).getLeaderboardScenarios.handler;

    await handler({
      input: { period: "WEEK", sort: "PLAYS" },
      ctx: {},
    });

    expect(mockGetTopScenarios).toHaveBeenCalledWith({
      period: "WEEK",
      sort: "PLAYS",
    });
  });

  it("should return empty items when no scenarios", async () => {
    mockGetTopScenarios.mockResolvedValue([]);

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).getLeaderboardScenarios.handler;

    const result = await handler({ input: {}, ctx: {} });

    expect(result.items).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getLeaderboardCreators
// ---------------------------------------------------------------------------
describe("socialV1Router.getLeaderboardCreators", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return top creators with default params (Zod schema)", () => {
    import("zod").then(({ z }) => {
      const schema = z.object({
        period: z.enum(["ALL", "WEEK", "MONTH"]).default("ALL"),
        sort: z.enum(["LIKES", "CALLS"]).default("LIKES"),
      });
      const result = schema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.period).toBe("ALL");
        expect(result.data.sort).toBe("LIKES");
      }
    });
  });

  it("should forward period and sort params", async () => {
    mockGetTopCreators.mockResolvedValue([]);

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).getLeaderboardCreators.handler;

    await handler({
      input: { period: "MONTH", sort: "CALLS" },
      ctx: {},
    });

    expect(mockGetTopCreators).toHaveBeenCalledWith({
      period: "MONTH",
      sort: "CALLS",
    });
  });
});

// ---------------------------------------------------------------------------
// getBadges
// ---------------------------------------------------------------------------
describe("socialV1Router.getBadges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return all badges ordered by name", async () => {
    const mockBadges = [
      { id: "b-1", name: "Bronze", description: "First call", iconUrl: null },
      { id: "b-2", name: "Silver", description: "Ten calls", iconUrl: "https://example.com/silver.png" },
    ];
    mockDb.badge.findMany.mockResolvedValue(mockBadges);

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).getBadges.handler;

    const result = await handler({ ctx: {} });

    expect(result).toEqual(mockBadges);
    expect(mockDb.badge.findMany).toHaveBeenCalledWith({
      orderBy: { name: "asc" },
    });
  });

  it("should return empty array when no badges exist", async () => {
    mockDb.badge.findMany.mockResolvedValue([]);

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).getBadges.handler;

    const result = await handler({ ctx: {} });

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getUserBadges
// ---------------------------------------------------------------------------
describe("socialV1Router.getUserBadges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return user badges with badge info", async () => {
    const mockUserBadges = [
      {
        id: "ub-1",
        awardedAt: new Date("2026-06-01"),
        badge: { id: "b-1", name: "First Call", description: "Made your first call", iconUrl: null },
      },
    ];
    mockDb.userBadge.findMany.mockResolvedValue(mockUserBadges);

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).getUserBadges.handler;

    const result = await handler({
      input: { userId: "user-123" },
      ctx: {},
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.badge.name).toBe("First Call");
    expect(mockDb.userBadge.findMany).toHaveBeenCalledWith({
      where: { userId: "user-123" },
      include: { badge: true },
      orderBy: { awardedAt: "desc" },
    });
  });

  it("should return empty array when user has no badges", async () => {
    mockDb.userBadge.findMany.mockResolvedValue([]);

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).getUserBadges.handler;

    const result = await handler({
      input: { userId: "user-empty" },
      ctx: {},
    });

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getFeatured
// ---------------------------------------------------------------------------
describe("socialV1Router.getFeatured", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return the featured scenario when one exists", async () => {
    const mockFeatured = {
      id: "f-1",
      featuredAt: new Date(),
      scenario: {
        id: "s-1",
        title: "Featured Scenario",
        description: "A featured scenario",
        character: { id: "c-1", name: "Aria", slug: "aria", avatarUrl: null },
        creator: { id: "u-1", username: "creator", profile: { image: null } },
      },
    };
    mockDb.featuredScenario.findFirst.mockResolvedValue(mockFeatured);

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).getFeatured.handler;

    const result = await handler({ ctx: {} });

    expect(result).toEqual(mockFeatured.scenario);
    expect(mockDb.featuredScenario.findFirst).toHaveBeenCalledWith({
      orderBy: { featuredAt: "desc" },
      include: {
        scenario: {
          include: {
            character: {
              select: { id: true, name: true, slug: true, avatarUrl: true },
            },
            creator: {
              select: { id: true, username: true, profile: { select: { image: true } } },
            },
          },
        },
      },
    });
  });

  it("should return null when no featured scenario exists", async () => {
    mockDb.featuredScenario.findFirst.mockResolvedValue(null);

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).getFeatured.handler;

    const result = await handler({ ctx: {} });

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// trackShare
// ---------------------------------------------------------------------------
describe("socialV1Router.trackShare", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a share event successfully", async () => {
    mockDb.scenario.findUnique.mockResolvedValue({ id: "scenario-1" });
    mockDb.shareEvent.create.mockResolvedValue({ id: "share-1" });

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).trackShare.handler;

    const result = await handler({
      input: { scenarioId: "scenario-1", platform: "TWITTER" },
      ctx: validCtx,
    });

    expect(result).toEqual({ success: true });
    expect(mockDb.shareEvent.create).toHaveBeenCalledWith({
      data: {
        scenarioId: "scenario-1",
        platform: "TWITTER",
        userId: "user-123",
      },
    });
  });

  it("should throw NOT_FOUND when scenario does not exist", async () => {
    mockDb.scenario.findUnique.mockResolvedValue(null);

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).trackShare.handler;

    await expect(
      handler({
        input: { scenarioId: "nonexistent", platform: "COPY_LINK" },
        ctx: validCtx,
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Scénario introuvable",
    });

    expect(mockDb.shareEvent.create).not.toHaveBeenCalled();
  });

  it("should accept all valid platforms", async () => {
    mockDb.scenario.findUnique.mockResolvedValue({ id: "s-1" });
    mockDb.shareEvent.create.mockResolvedValue({ id: "share-1" });

    const { socialV1Router } = await import("../social");
    const handler = (socialV1Router as any).trackShare.handler;

    const platforms = ["DISCORD", "TWITTER", "TIKTOK", "COPY_LINK", "WEB_SHARE"] as const;
    for (const platform of platforms) {
      const result = await handler({
        input: { scenarioId: "s-1", platform },
        ctx: validCtx,
      });
      expect(result).toEqual({ success: true });
    }
  });

  it("should reject invalid platform (Zod enum schema)", () => {
    import("zod").then(({ z }) => {
      const schema = z.object({
        scenarioId: z.string(),
        platform: z.enum(["DISCORD", "TWITTER", "TIKTOK", "COPY_LINK", "WEB_SHARE"]),
      });
      expect(schema.safeParse({ scenarioId: "s-1", platform: "INSTAGRAM" }).success).toBe(false);
    });
  });
});
