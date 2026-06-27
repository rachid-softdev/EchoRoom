import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// socialRouter tests — toggleLike, getReactions, getLeaderboardScenarios,
// getLeaderboardCreators, getBadges, getUserBadges, getFeatured, trackShare
// ---------------------------------------------------------------------------

const mockDb = vi.hoisted(() => ({
  shareEvent: {
    create: vi.fn(),
  },
  scenario: {
    findUnique: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  reaction: {
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
  },
  userSocial: {
    upsert: vi.fn(),
  },
  badge: {
    findMany: vi.fn(),
  },
  userBadge: {
    findMany: vi.fn(),
  },
  featuredScenario: {
    findFirst: vi.fn(),
  },
  call: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  db: mockDb,
}));

const mockTx = vi.hoisted(() => ({
  reaction: {
    create: vi.fn(),
    delete: vi.fn(),
  },
  scenario: {
    update: vi.fn(),
  },
  userSocial: {
    upsert: vi.fn(),
  },
}));

// Mock service modules
vi.mock("@/server/services/social/badges", () => ({
  checkAndAwardBadges: vi.fn(),
}));

vi.mock("@/server/services/social/leaderboard", () => ({
  getTopScenarios: vi.fn(),
  getTopCreators: vi.fn(),
}));

vi.mock("@/server/services/social/clips", () => ({
  createClip: vi.fn(),
  deleteClip: vi.fn(),
  getClips: vi.fn(),
}));

// Mock tRPC to capture mutation/query handlers for direct testing
vi.mock("@/server/trpc", () => {
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
    t: { procedure: chain },
    router: vi.fn((routes: Record<string, unknown>) => routes),
    publicProcedure: chain,
    protectedProcedure: chain,
    adminProcedure: chain,
    middleware: vi.fn((fn: Function) => fn),
    withRateLimit: vi.fn(() => (opts: { next: Function }) => opts.next()),
    withIPRateLimit: vi.fn(() => (opts: { next: Function }) => opts.next()),
    withTracing: vi.fn(() => chain),
    isAuthenticated: chain,
    isAdmin: chain,
  };
});

type TrackShareInput = {
  input: { scenarioId: string; platform: string };
  ctx: { session?: { user?: { id: string } } | null };
};
type TrackShareHandler = (opts: TrackShareInput) => Promise<{ success: boolean }>;

type ToggleLikeInput = {
  input: { scenarioId: string; emoji: string };
  ctx: { session: { user: { id: string } } };
};
type ToggleLikeHandler = (opts: ToggleLikeInput) => Promise<{
  reacted: boolean;
  emoji: string;
  newBadge: unknown;
}>;

type GetReactionsInput = {
  input: { scenarioId: string };
  ctx: { session?: { user?: { id: string } } | null };
};
type GetReactionsHandler = (
  opts: GetReactionsInput,
) => Promise<{ reactions: Array<{ emoji: string; count: number; userReacted: boolean }> }>;

type LeaderboardInput = { input: { period?: string; sort?: string } };
type LeaderboardHandler = (opts: LeaderboardInput) => Promise<{ items: unknown[] }>;

type BadgesHandler = () => Promise<unknown[]>;
type GetUserBadgesInput = { input: { userId: string } };
type GetUserBadgesHandler = (opts: GetUserBadgesInput) => Promise<unknown[]>;

type GetFeaturedHandler = () => Promise<unknown>;

describe("socialRouter.trackShare", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.scenario.findUnique.mockResolvedValue({ id: "scenario-abc" });
  });

  it("should create a ShareEvent record and return { success: true }", async () => {
    mockDb.shareEvent.create.mockResolvedValue({ id: "share-1" });

    const { socialRouter } = await import("../social");

    // @ts-expect-error — mutation handler is captured at module import time
    const handler: TrackShareHandler = socialRouter.trackShare.handler;

    const result = await handler({
      input: { scenarioId: "scenario-abc", platform: "TWITTER" },
      ctx: { session: { user: { id: "user-1" } } },
    });

    expect(result).toEqual({ success: true });

    expect(mockDb.shareEvent.create).toHaveBeenCalledTimes(1);
    expect(mockDb.shareEvent.create).toHaveBeenCalledWith({
      data: {
        scenarioId: "scenario-abc",
        platform: "TWITTER",
        userId: "user-1",
      },
    });
  });

  it("should pass the user ID to ShareEvent create", async () => {
    mockDb.shareEvent.create.mockResolvedValue({ id: "share-2" });

    const { socialRouter } = await import("../social");

    // @ts-expect-error — mutation handler is captured at module import time
    const handler: TrackShareHandler = socialRouter.trackShare.handler;

    await handler({
      input: { scenarioId: "scenario-xyz", platform: "DISCORD" },
      ctx: { session: { user: { id: "user-2" } } },
    });

    expect(mockDb.shareEvent.create).toHaveBeenCalledWith({
      data: {
        scenarioId: "scenario-xyz",
        platform: "DISCORD",
        userId: "user-2",
      },
    });
  });

  it("should verify the scenario exists before creating a share", async () => {
    mockDb.shareEvent.create.mockResolvedValue({ id: "share-3" });

    const { socialRouter } = await import("../social");

    // @ts-expect-error — mutation handler is captured at module import time
    const handler: TrackShareHandler = socialRouter.trackShare.handler;

    await handler({
      input: { scenarioId: "scenario-xyz", platform: "COPY_LINK" },
      ctx: { session: { user: { id: "user-3" } } },
    });

    expect(mockDb.scenario.findUnique).toHaveBeenCalledWith({
      where: { id: "scenario-xyz" },
      select: { id: true },
    });
  });

  it("should work with WEB_SHARE platform", async () => {
    mockDb.shareEvent.create.mockResolvedValue({ id: "share-4" });

    const { socialRouter } = await import("../social");

    // @ts-expect-error — mutation handler is captured at module import time
    const handler: TrackShareHandler = socialRouter.trackShare.handler;

    const result = await handler({
      input: { scenarioId: "scenario-123", platform: "WEB_SHARE" },
      ctx: { session: { user: { id: "user-2" } } },
    });

    expect(result).toEqual({ success: true });
    expect(mockDb.shareEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scenarioId: "scenario-123",
          platform: "WEB_SHARE",
        }),
      }),
    );
  });

  it("should work with TIKTOK platform", async () => {
    mockDb.shareEvent.create.mockResolvedValue({ id: "share-5" });

    const { socialRouter } = await import("../social");

    // @ts-expect-error — mutation handler is captured at module import time
    const handler: TrackShareHandler = socialRouter.trackShare.handler;

    const result = await handler({
      input: { scenarioId: "scenario-456", platform: "TIKTOK" },
      ctx: { session: { user: { id: "user-3" } } },
    });

    expect(result).toEqual({ success: true });
  });

  it("should create ShareEvent with correct scenarioId", async () => {
    mockDb.shareEvent.create.mockResolvedValue({ id: "share-6" });

    const { socialRouter } = await import("../social");

    // @ts-expect-error — mutation handler is captured at module import time
    const handler: TrackShareHandler = socialRouter.trackShare.handler;

    await handler({
      input: { scenarioId: "specific-scenario-id", platform: "COPY_LINK" },
      ctx: { session: { user: { id: "user-4" } } },
    });

    expect(mockDb.shareEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scenarioId: "specific-scenario-id",
        }),
      }),
    );
  });

  it("should throw NOT_FOUND when scenario does not exist", async () => {
    mockDb.scenario.findUnique.mockResolvedValue(null);

    const { socialRouter } = await import("../social");

    // @ts-expect-error — mutation handler is captured at module import time
    const handler: TrackShareHandler = socialRouter.trackShare.handler;

    await expect(
      handler({
        input: { scenarioId: "nonexistent", platform: "TWITTER" },
        ctx: { session: { user: { id: "user-1" } } },
      }),
    ).rejects.toThrow("Scénario introuvable");
  });

  it("should allow duplicate share events (no unique constraint)", async () => {
    mockDb.shareEvent.create.mockResolvedValue({ id: "share-dup" });
    mockDb.scenario.findUnique.mockResolvedValue({ id: "scenario-abc" });

    const { socialRouter } = await import("../social");

    // @ts-expect-error — mutation handler is captured at module import time
    const handler: TrackShareHandler = socialRouter.trackShare.handler;

    // First share
    await handler({
      input: { scenarioId: "scenario-abc", platform: "TWITTER" },
      ctx: { session: { user: { id: "user-1" } } },
    });

    // Second share — same scenario, same user, same platform
    const result = await handler({
      input: { scenarioId: "scenario-abc", platform: "TWITTER" },
      ctx: { session: { user: { id: "user-1" } } },
    });

    expect(result).toEqual({ success: true });
    expect(mockDb.shareEvent.create).toHaveBeenCalledTimes(2);
  });
});

describe("socialRouter.toggleLike", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: $transaction calls the callback with mockTx
    mockDb.$transaction.mockImplementation(async (cb: Function) => cb(mockTx));
    mockTx.reaction.create.mockReset();
    mockTx.reaction.delete.mockReset();
    mockTx.scenario.update.mockReset();
    mockTx.userSocial.upsert.mockReset();
  });

  it("should toggle on: create reaction, increment likeCount, upsert UserSocial", async () => {
    mockDb.reaction.findUnique.mockResolvedValue(null); // No existing reaction
    mockDb.scenario.findUnique.mockResolvedValue({ id: "scenario-1", creatorId: "creator-1" });
    mockTx.reaction.create.mockResolvedValue({ id: "reaction-new" });
    mockTx.scenario.update.mockResolvedValue({ id: "scenario-1", likeCount: 1 });
    mockTx.userSocial.upsert.mockResolvedValue({ userId: "creator-1", totalLikesReceived: 1 });

    const { checkAndAwardBadges } = await import("@/server/services/social/badges");
    (checkAndAwardBadges as any).mockResolvedValue(null);

    const { socialRouter } = await import("../social");

    // @ts-expect-error — mutation handler is captured at module import time
    const handler: ToggleLikeHandler = socialRouter.toggleLike.handler;

    const result = await handler({
      input: { scenarioId: "scenario-1", emoji: "👍" },
      ctx: { session: { user: { id: "user-1" } } },
    });

    expect(result).toEqual({ reacted: true, emoji: "👍", newBadge: null });

    expect(mockDb.reaction.findUnique).toHaveBeenCalledWith({
      where: {
        userId_scenarioId_emoji: { userId: "user-1", scenarioId: "scenario-1", emoji: "👍" },
      },
    });

    expect(mockDb.scenario.findUnique).toHaveBeenCalledWith({
      where: { id: "scenario-1" },
      select: { creatorId: true },
    });

    expect(mockTx.reaction.create).toHaveBeenCalledWith({
      data: { userId: "user-1", scenarioId: "scenario-1", emoji: "👍" },
    });

    expect(mockTx.scenario.update).toHaveBeenCalledWith({
      where: { id: "scenario-1" },
      data: { likeCount: { increment: 1 } },
    });

    expect(mockTx.userSocial.upsert).toHaveBeenCalledWith({
      where: { userId: "creator-1" },
      create: { userId: "creator-1", totalLikesReceived: 1 },
      update: { totalLikesReceived: { increment: 1 } },
    });

    expect(checkAndAwardBadges).toHaveBeenCalledWith("creator-1", "LIKE_RECEIVED");
  });

  it("should toggle off: delete reaction, decrement likeCount, decrement UserSocial", async () => {
    mockDb.reaction.findUnique.mockResolvedValue({
      id: "reaction-1",
      userId: "user-1",
      scenarioId: "scenario-1",
      emoji: "👍",
    });
    mockDb.scenario.findUnique.mockResolvedValue({ id: "scenario-1", creatorId: "creator-1" });
    mockTx.reaction.delete.mockResolvedValue({ id: "reaction-1" });
    mockTx.scenario.update.mockResolvedValue({ id: "scenario-1", likeCount: 0 });
    mockTx.userSocial.upsert.mockResolvedValue({ userId: "creator-1", totalLikesReceived: 0 });

    const { socialRouter } = await import("../social");

    // @ts-expect-error — mutation handler is captured at module import time
    const handler: ToggleLikeHandler = socialRouter.toggleLike.handler;

    const result = await handler({
      input: { scenarioId: "scenario-1", emoji: "👍" },
      ctx: { session: { user: { id: "user-1" } } },
    });

    expect(result).toEqual({ reacted: false, emoji: "👍", newBadge: null });

    expect(mockTx.reaction.delete).toHaveBeenCalledWith({ where: { id: "reaction-1" } });
    expect(mockTx.scenario.update).toHaveBeenCalledWith({
      where: { id: "scenario-1" },
      data: { likeCount: { decrement: 1 } },
    });
    expect(mockTx.userSocial.upsert).toHaveBeenCalledWith({
      where: { userId: "creator-1" },
      create: { userId: "creator-1" },
      update: { totalLikesReceived: { decrement: 1 } },
    });
  });

  it("should toggle on with different emoji when same emoji toggled off", async () => {
    // First toggle on "👍" — no existing reaction
    mockDb.reaction.findUnique.mockResolvedValue(null);
    mockDb.scenario.findUnique.mockResolvedValue({ id: "scenario-1", creatorId: "creator-1" });
    mockTx.reaction.create.mockResolvedValue({ id: "reaction-new" });
    mockTx.scenario.update.mockResolvedValue({});
    mockTx.userSocial.upsert.mockResolvedValue({});

    const { checkAndAwardBadges } = await import("@/server/services/social/badges");
    (checkAndAwardBadges as any).mockResolvedValue(null);

    const { socialRouter } = await import("../social");
    // @ts-expect-error — mutation handler is captured at module import time
    const handler: ToggleLikeHandler = socialRouter.toggleLike.handler;

    await handler({
      input: { scenarioId: "scenario-1", emoji: "👍" },
      ctx: { session: { user: { id: "user-1" } } },
    });

    // Now toggle on "❤️" — different emoji, should create a new reaction
    mockDb.reaction.findUnique.mockResolvedValue(null);
    mockDb.scenario.findUnique.mockResolvedValue({ id: "scenario-1", creatorId: "creator-1" });

    const result = await handler({
      input: { scenarioId: "scenario-1", emoji: "❤️" },
      ctx: { session: { user: { id: "user-1" } } },
    });

    expect(result).toEqual({ reacted: true, emoji: "❤️", newBadge: null });
    // Two separate creates: one for the first emoji, one for the second
    expect(mockDb.reaction.findUnique).toHaveBeenLastCalledWith({
      where: {
        userId_scenarioId_emoji: { userId: "user-1", scenarioId: "scenario-1", emoji: "❤️" },
      },
    });
  });

  it("should toggle on twice with same emoji: first creates, second deletes (toggle off)", async () => {
    // First call: no existing reaction → create
    mockDb.reaction.findUnique.mockResolvedValue(null);
    mockDb.scenario.findUnique.mockResolvedValue({ id: "scenario-1", creatorId: "creator-1" });
    mockTx.reaction.create.mockResolvedValue({ id: "reaction-new" });
    mockTx.scenario.update.mockResolvedValue({});
    mockTx.userSocial.upsert.mockResolvedValue({});

    const { checkAndAwardBadges } = await import("@/server/services/social/badges");
    (checkAndAwardBadges as any).mockResolvedValue(null);

    const { socialRouter } = await import("../social");
    // @ts-expect-error — mutation handler is captured at module import time
    const handler: ToggleLikeHandler = socialRouter.toggleLike.handler;

    const firstResult = await handler({
      input: { scenarioId: "scenario-1", emoji: "👍" },
      ctx: { session: { user: { id: "user-1" } } },
    });
    expect(firstResult.reacted).toBe(true);

    // Second call: existing reaction found → delete (toggle off)
    mockDb.reaction.findUnique.mockResolvedValue({
      id: "reaction-1",
      userId: "user-1",
      scenarioId: "scenario-1",
      emoji: "👍",
    });
    mockDb.scenario.findUnique.mockResolvedValue({ id: "scenario-1", creatorId: "creator-1" });
    mockTx.reaction.delete.mockResolvedValue({});

    const secondResult = await handler({
      input: { scenarioId: "scenario-1", emoji: "👍" },
      ctx: { session: { user: { id: "user-1" } } },
    });
    expect(secondResult.reacted).toBe(false);
  });

  it("should throw NOT_FOUND when scenario does not exist", async () => {
    mockDb.reaction.findUnique.mockResolvedValue(null);
    mockDb.scenario.findUnique.mockResolvedValue(null);

    const { socialRouter } = await import("../social");
    // @ts-expect-error — mutation handler is captured at module import time
    const handler: ToggleLikeHandler = socialRouter.toggleLike.handler;

    await expect(
      handler({
        input: { scenarioId: "nonexistent", emoji: "👍" },
        ctx: { session: { user: { id: "user-1" } } },
      }),
    ).rejects.toThrow("Scénario introuvable");
  });

  it("should return newBadge when badge conditions are met", async () => {
    mockDb.reaction.findUnique.mockResolvedValue(null);
    mockDb.scenario.findUnique.mockResolvedValue({ id: "scenario-1", creatorId: "creator-1" });
    mockTx.reaction.create.mockResolvedValue({ id: "reaction-new" });
    mockTx.scenario.update.mockResolvedValue({});
    mockTx.userSocial.upsert.mockResolvedValue({});

    const mockBadge = {
      id: "badge-1",
      name: "First Like Received",
      description: "You received your first like!",
      iconUrl: null,
    };
    const { checkAndAwardBadges } = await import("@/server/services/social/badges");
    (checkAndAwardBadges as any).mockResolvedValue(mockBadge);

    const { socialRouter } = await import("../social");
    // @ts-expect-error — mutation handler is captured at module import time
    const handler: ToggleLikeHandler = socialRouter.toggleLike.handler;

    const result = await handler({
      input: { scenarioId: "scenario-1", emoji: "👍" },
      ctx: { session: { user: { id: "user-1" } } },
    });

    expect(result.newBadge).toEqual(mockBadge);
  });

  it("should not award badge when conditions are not met", async () => {
    mockDb.reaction.findUnique.mockResolvedValue(null);
    mockDb.scenario.findUnique.mockResolvedValue({ id: "scenario-1", creatorId: "creator-1" });
    mockTx.reaction.create.mockResolvedValue({ id: "reaction-new" });
    mockTx.scenario.update.mockResolvedValue({});
    mockTx.userSocial.upsert.mockResolvedValue({});

    const { checkAndAwardBadges } = await import("@/server/services/social/badges");
    (checkAndAwardBadges as any).mockResolvedValue(null);

    const { socialRouter } = await import("../social");
    // @ts-expect-error — mutation handler is captured at module import time
    const handler: ToggleLikeHandler = socialRouter.toggleLike.handler;

    const result = await handler({
      input: { scenarioId: "scenario-1", emoji: "👍" },
      ctx: { session: { user: { id: "user-1" } } },
    });

    expect(result.newBadge).toBeNull();
  });

  it("should create UserSocial on first toggle (upsert create path)", async () => {
    mockDb.reaction.findUnique.mockResolvedValue(null);
    mockDb.scenario.findUnique.mockResolvedValue({ id: "scenario-1", creatorId: "new-creator" });
    mockTx.reaction.create.mockResolvedValue({ id: "reaction-new" });
    mockTx.scenario.update.mockResolvedValue({});
    mockTx.userSocial.upsert.mockResolvedValue({ userId: "new-creator", totalLikesReceived: 1 });

    const { checkAndAwardBadges } = await import("@/server/services/social/badges");
    (checkAndAwardBadges as any).mockResolvedValue(null);

    const { socialRouter } = await import("../social");
    // @ts-expect-error — mutation handler is captured at module import time
    const handler: ToggleLikeHandler = socialRouter.toggleLike.handler;

    await handler({
      input: { scenarioId: "scenario-1", emoji: "👍" },
      ctx: { session: { user: { id: "user-1" } } },
    });

    expect(mockTx.userSocial.upsert).toHaveBeenCalledWith({
      where: { userId: "new-creator" },
      create: { userId: "new-creator", totalLikesReceived: 1 },
      update: { totalLikesReceived: { increment: 1 } },
    });
  });
});

describe("socialRouter.getReactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return reactions grouped by emoji with userReacted flags", async () => {
    mockDb.reaction.groupBy.mockResolvedValue([
      { emoji: "👍", _count: 3 },
      { emoji: "❤️", _count: 1 },
    ]);
    mockDb.reaction.findMany.mockResolvedValue([{ emoji: "👍" }, { emoji: "❤️" }]);

    const { socialRouter } = await import("../social");
    // @ts-expect-error — query handler is captured at module import time
    const handler: GetReactionsHandler = socialRouter.getReactions.handler;

    const result = await handler({
      input: { scenarioId: "scenario-1" },
      ctx: { session: { user: { id: "user-1" } } },
    });

    expect(result.reactions).toHaveLength(2);
    expect(result.reactions[0]).toEqual({ emoji: "👍", count: 3, userReacted: true });
    expect(result.reactions[1]).toEqual({ emoji: "❤️", count: 1, userReacted: true });
  });

  it("should set userReacted false when user did not react to an emoji", async () => {
    mockDb.reaction.groupBy.mockResolvedValue([
      { emoji: "👍", _count: 5 },
      { emoji: "😂", _count: 2 },
    ]);
    // User only reacted with 👍
    mockDb.reaction.findMany.mockResolvedValue([{ emoji: "👍" }]);

    const { socialRouter } = await import("../social");
    // @ts-expect-error — query handler is captured at module import time
    const handler: GetReactionsHandler = socialRouter.getReactions.handler;

    const result = await handler({
      input: { scenarioId: "scenario-1" },
      ctx: { session: { user: { id: "user-1" } } },
    });

    expect(result.reactions.find((r) => r.emoji === "👍")?.userReacted).toBe(true);
    expect(result.reactions.find((r) => r.emoji === "😂")?.userReacted).toBe(false);
  });

  it("should set userReacted false for all when user is not authenticated", async () => {
    mockDb.reaction.groupBy.mockResolvedValue([{ emoji: "👍", _count: 3 }]);

    const { socialRouter } = await import("../social");
    // @ts-expect-error — query handler is captured at module import time
    const handler: GetReactionsHandler = socialRouter.getReactions.handler;

    const result = await handler({
      input: { scenarioId: "scenario-1" },
      ctx: { session: null },
    });

    expect(result.reactions[0]?.userReacted).toBe(false);
    // Should NOT have called findMany for user reactions
    expect(mockDb.reaction.findMany).not.toHaveBeenCalled();
  });

  it("should return empty array when no reactions exist", async () => {
    mockDb.reaction.groupBy.mockResolvedValue([]);

    const { socialRouter } = await import("../social");
    // @ts-expect-error — query handler is captured at module import time
    const handler: GetReactionsHandler = socialRouter.getReactions.handler;

    const result = await handler({
      input: { scenarioId: "scenario-no-reactions" },
      ctx: { session: { user: { id: "user-1" } } },
    });

    expect(result.reactions).toEqual([]);
  });
});

describe("socialRouter.getLeaderboardScenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return top scenarios for ALL+LIKES", async () => {
    const { getTopScenarios } = await import("@/server/services/social/leaderboard");
    const mockItems = [
      { id: "s-1", title: "Top Scenario", likeCount: 100 },
      { id: "s-2", title: "Second", likeCount: 50 },
    ];
    (getTopScenarios as any).mockResolvedValue(mockItems);

    const { socialRouter } = await import("../social");
    // @ts-expect-error — query handler is captured at module import time
    const handler: LeaderboardHandler = socialRouter.getLeaderboardScenarios.handler;

    const result = await handler({
      input: { period: "ALL", sort: "LIKES" },
    });

    expect(result.items).toEqual(mockItems);
    expect(getTopScenarios).toHaveBeenCalledWith({ period: "ALL", sort: "LIKES" });
  });

  it("should return top scenarios for WEEK+PLAYS", async () => {
    const { getTopScenarios } = await import("@/server/services/social/leaderboard");
    (getTopScenarios as any).mockResolvedValue([]);

    const { socialRouter } = await import("../social");
    // @ts-expect-error — query handler is captured at module import time
    const handler: LeaderboardHandler = socialRouter.getLeaderboardScenarios.handler;

    await handler({
      input: { period: "WEEK", sort: "PLAYS" },
    });

    expect(getTopScenarios).toHaveBeenCalledWith({ period: "WEEK", sort: "PLAYS" });
  });

  it("should return empty array when no data", async () => {
    const { getTopScenarios } = await import("@/server/services/social/leaderboard");
    (getTopScenarios as any).mockResolvedValue([]);

    const { socialRouter } = await import("../social");
    // @ts-expect-error — query handler is captured at module import time
    const handler: LeaderboardHandler = socialRouter.getLeaderboardScenarios.handler;

    const result = await handler({
      input: { period: "MONTH", sort: "LIKES" },
    });

    expect(result.items).toEqual([]);
  });
});

describe("socialRouter.getLeaderboardCreators", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return top creators for ALL+LIKES", async () => {
    const { getTopCreators } = await import("@/server/services/social/leaderboard");
    const mockItems = [
      { id: "u-1", username: "Alice", totalLikesReceived: 200 },
      { id: "u-2", username: "Bob", totalLikesReceived: 100 },
    ];
    (getTopCreators as any).mockResolvedValue(mockItems);

    const { socialRouter } = await import("../social");
    // @ts-expect-error — query handler is captured at module import time
    const handler: LeaderboardHandler = socialRouter.getLeaderboardCreators.handler;

    const result = await handler({
      input: { period: "ALL", sort: "LIKES" },
    });

    expect(result.items).toEqual(mockItems);
    expect(getTopCreators).toHaveBeenCalledWith({ period: "ALL", sort: "LIKES" });
  });

  it("should return top creators for MONTH+CALLS", async () => {
    const { getTopCreators } = await import("@/server/services/social/leaderboard");
    (getTopCreators as any).mockResolvedValue([]);

    const { socialRouter } = await import("../social");
    // @ts-expect-error — query handler is captured at module import time
    const handler: LeaderboardHandler = socialRouter.getLeaderboardCreators.handler;

    await handler({
      input: { period: "MONTH", sort: "CALLS" },
    });

    expect(getTopCreators).toHaveBeenCalledWith({ period: "MONTH", sort: "CALLS" });
  });

  it("should return empty when no data", async () => {
    const { getTopCreators } = await import("@/server/services/social/leaderboard");
    (getTopCreators as any).mockResolvedValue([]);

    const { socialRouter } = await import("../social");
    // @ts-expect-error — query handler is captured at module import time
    const handler: LeaderboardHandler = socialRouter.getLeaderboardCreators.handler;

    const result = await handler({
      input: { period: "WEEK", sort: "LIKES" },
    });

    expect(result.items).toEqual([]);
  });
});

describe("socialRouter.getBadges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return all badges ordered by name asc", async () => {
    const mockBadges = [
      { id: "b-1", name: "First Call", description: "Make your first call" },
      { id: "b-2", name: "Popular Creator", description: "Get 100 likes" },
    ];
    mockDb.badge.findMany.mockResolvedValue(mockBadges);

    const { socialRouter } = await import("../social");
    // @ts-expect-error — query handler is captured at module import time
    const handler: BadgesHandler = socialRouter.getBadges.handler;

    const result = await handler();

    expect(result).toEqual(mockBadges);
    expect(mockDb.badge.findMany).toHaveBeenCalledWith({
      orderBy: { name: "asc" },
    });
  });

  it("should return empty array when no badges exist", async () => {
    mockDb.badge.findMany.mockResolvedValue([]);

    const { socialRouter } = await import("../social");
    // @ts-expect-error — query handler is captured at module import time
    const handler: BadgesHandler = socialRouter.getBadges.handler;

    const result = await handler();

    expect(result).toEqual([]);
  });
});

describe("socialRouter.getUserBadges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return badges for a user with badge info and awardedAt", async () => {
    const mockUserBadges = [
      {
        id: "ub-1",
        userId: "user-1",
        badgeId: "badge-1",
        awardedAt: new Date("2026-06-01"),
        badge: {
          id: "badge-1",
          name: "First Call",
          description: "Made your first call",
          iconUrl: null,
        },
      },
    ];
    mockDb.userBadge.findMany.mockResolvedValue(mockUserBadges);

    const { socialRouter } = await import("../social");
    // @ts-expect-error — query handler is captured at module import time
    const handler: GetUserBadgesHandler = socialRouter.getUserBadges.handler;

    const result = await handler({
      input: { userId: "user-1" },
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("id", "ub-1");
    expect(result[0]).toHaveProperty("badge");
    expect(result[0]).toHaveProperty("awardedAt");
    expect((result[0] as any)?.badge.name).toBe("First Call");
  });

  it("should return empty array for user with no badges", async () => {
    mockDb.userBadge.findMany.mockResolvedValue([]);

    const { socialRouter } = await import("../social");
    // @ts-expect-error — query handler is captured at module import time
    const handler: GetUserBadgesHandler = socialRouter.getUserBadges.handler;

    const result = await handler({
      input: { userId: "user-no-badges" },
    });

    expect(result).toEqual([]);
  });

  it("should return empty array for non-existent userId", async () => {
    mockDb.userBadge.findMany.mockResolvedValue([]);

    const { socialRouter } = await import("../social");
    // @ts-expect-error — query handler is captured at module import time
    const handler: GetUserBadgesHandler = socialRouter.getUserBadges.handler;

    const result = await handler({
      input: { userId: "nonexistent-user" },
    });

    expect(result).toEqual([]);
  });
});

describe("socialRouter.getFeatured", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return the featured scenario when one exists", async () => {
    const mockScenario = { id: "s-1", title: "Featured Scenario" };
    mockDb.featuredScenario.findFirst.mockResolvedValue({
      id: "fs-1",
      scenario: mockScenario,
      featuredAt: new Date(),
    });

    const { socialRouter } = await import("../social");
    // @ts-expect-error — query handler is captured at module import time
    const handler: GetFeaturedHandler = socialRouter.getFeatured.handler;

    const result = await handler();

    expect(result).toEqual(mockScenario);
    expect(mockDb.featuredScenario.findFirst).toHaveBeenCalledWith({
      orderBy: { featuredAt: "desc" },
      include: expect.objectContaining({
        scenario: expect.objectContaining({
          include: expect.objectContaining({
            character: expect.any(Object),
            creator: expect.any(Object),
          }),
        }),
      }),
    });
  });

  it("should return null when no featured scenario exists", async () => {
    mockDb.featuredScenario.findFirst.mockResolvedValue(null);

    const { socialRouter } = await import("../social");
    // @ts-expect-error — query handler is captured at module import time
    const handler: GetFeaturedHandler = socialRouter.getFeatured.handler;

    const result = await handler();

    expect(result).toBeNull();
  });
});
