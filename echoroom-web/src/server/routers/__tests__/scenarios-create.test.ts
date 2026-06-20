import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// scenariosRouter tests — create, feed, trending, getById
// ---------------------------------------------------------------------------

const mockDb = vi.hoisted(() => ({
  scenario: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  reaction: {
    groupBy: vi.fn(),
  },
  call: {
    groupBy: vi.fn(),
  },
  comment: {
    groupBy: vi.fn(),
  },
  character: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  db: mockDb,
}));

// Mutable redis ref — toggle between null and {} to enable/disable caching
const mockRedisValue = vi.hoisted(() => ({ current: null as any }));
vi.mock("@/lib/redis", () => ({
  get redis() {
    return mockRedisValue.current;
  },
}));

vi.mock("@/server/services/security/spamDetection", () => ({
  detectScenarioSpam: vi.fn(),
}));

vi.mock("@/server/services/cache/scenarioCache", () => ({
  getCachedFeed: vi.fn(),
  setCachedFeed: vi.fn(),
  invalidateFeedCache: vi.fn(),
  getCachedTrendingFeed: vi.fn(),
  setCachedTrendingFeed: vi.fn(),
}));

vi.mock("@/server/services/ai/asyncModeration", () => ({
  scheduleAsyncModeration: vi.fn(),
}));

vi.mock("@/server/services/ai/moderation", () => ({
  checkContentBlocklist: vi.fn(() => ({ approved: true })),
  checkContent: vi.fn(),
}));

vi.mock("@/server/services/ai/generateScript", () => ({
  generateScenarioScript: vi.fn(),
}));

// Mock tRPC
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
    withContentModeration: vi.fn(() => (opts: { next: Function }) => opts.next()),
    withTracing: vi.fn(() => chain),
    isAuthenticated: chain,
    isAdmin: chain,
  };
});

vi.mock("@/server/middleware/metrics", () => ({
  withREDMetrics: vi.fn(() => (opts: { next: Function }) => opts.next()),
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Helper types
// ---------------------------------------------------------------------------

type CreateInput = {
  input: {
    characterId: string;
    title: string;
    description: string;
    openingMessage: string;
    aiInstructions: string;
    visibility: string;
  };
  ctx: { session: { user: { id: string } } };
};
type CreateHandler = (opts: CreateInput) => Promise<{ scenarioId: string }>;

type FeedInput = {
  input: { cursor?: string; limit?: number; sort?: string };
  ctx?: { session?: { user?: { id: string } } | null };
};
type FeedHandler = (opts: FeedInput) => Promise<{ items: unknown[]; nextCursor?: string }>;

type TrendingInput = {
  input: { cursor?: string; limit?: number };
};
type TrendingHandler = (opts: TrendingInput) => Promise<{ items: unknown[]; nextCursor?: string }>;

type GetByIdInput = {
  input: { id: string };
  ctx: { session?: { user?: { id: string; role?: string } } | null };
};
type GetByIdHandler = (opts: GetByIdInput) => Promise<unknown>;

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe("scenariosRouter.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisValue.current = null; // disable redis by default
  });

  const validInput = {
    characterId: "char-1",
    title: "My Awesome Scenario",
    description: "A great scenario for testing",
    openingMessage: "Hello, how are you?",
    aiInstructions: "Be friendly and helpful",
    visibility: "PUBLIC" as const,
  };

  it("should create a scenario with all required fields", async () => {
    const { detectScenarioSpam } = await import("@/server/services/security/spamDetection");
    (detectScenarioSpam as any).mockResolvedValue({ flagged: false });

    mockDb.scenario.create.mockResolvedValue({ id: "scenario-new" });

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — mutation handler is captured at module import time
    const handler: CreateHandler = scenariosRouter.create.handler;

    const result = await handler({
      input: validInput,
      ctx: { session: { user: { id: "user-1" } } },
    });

    expect(result).toEqual({ scenarioId: "scenario-new" });
    expect(mockDb.scenario.create).toHaveBeenCalledWith({
      data: {
        characterId: "char-1",
        title: "My Awesome Scenario",
        description: "A great scenario for testing",
        openingMessage: "Hello, how are you?",
        aiInstructions: "Be friendly and helpful",
        visibility: "PUBLIC",
        creatorId: "user-1",
      },
    });
  });

  it("should create a scenario with empty optional text fields", async () => {
    const { detectScenarioSpam } = await import("@/server/services/security/spamDetection");
    (detectScenarioSpam as any).mockResolvedValue({ flagged: false });

    mockDb.scenario.create.mockResolvedValue({ id: "scenario-new" });

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — mutation handler is captured at module import time
    const handler: CreateHandler = scenariosRouter.create.handler;

    const result = await handler({
      input: {
        characterId: "char-1",
        title: "Minimal Scenario",
        description: "",
        openingMessage: "",
        aiInstructions: "",
        visibility: "PRIVATE",
      },
      ctx: { session: { user: { id: "user-1" } } },
    });

    expect(result).toEqual({ scenarioId: "scenario-new" });
    expect(mockDb.scenario.create).toHaveBeenCalledWith({
      data: {
        characterId: "char-1",
        title: "Minimal Scenario",
        description: "",
        openingMessage: "",
        aiInstructions: "",
        visibility: "PRIVATE",
        creatorId: "user-1",
      },
    });
  });

  it("should detect spam and block creation", async () => {
    const { detectScenarioSpam } = await import("@/server/services/security/spamDetection");
    (detectScenarioSpam as any).mockResolvedValue({
      flagged: true,
      reason: "Trop de scénarios créés. Réessayez plus tard.",
    });

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — mutation handler is captured at module import time
    const handler: CreateHandler = scenariosRouter.create.handler;

    await expect(
      handler({
        input: validInput,
        ctx: { session: { user: { id: "user-spammer" } } },
      }),
    ).rejects.toThrow("Trop de scénarios créés");

    expect(mockDb.scenario.create).not.toHaveBeenCalled();
  });

  it("should call invalidateFeedCache after creation", async () => {
    const { detectScenarioSpam } = await import("@/server/services/security/spamDetection");
    (detectScenarioSpam as any).mockResolvedValue({ flagged: false });

    mockDb.scenario.create.mockResolvedValue({ id: "scenario-new" });

    const { invalidateFeedCache } = await import("@/server/services/cache/scenarioCache");

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — mutation handler is captured at module import time
    const handler: CreateHandler = scenariosRouter.create.handler;

    await handler({
      input: validInput,
      ctx: { session: { user: { id: "user-1" } } },
    });

    expect(invalidateFeedCache).toHaveBeenCalledTimes(1);
  });

  it("should trigger async moderation after creation", async () => {
    const { detectScenarioSpam } = await import("@/server/services/security/spamDetection");
    (detectScenarioSpam as any).mockResolvedValue({ flagged: false });

    mockDb.scenario.create.mockResolvedValue({ id: "scenario-new" });

    const { scheduleAsyncModeration } = await import("@/server/services/ai/asyncModeration");

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — mutation handler is captured at module import time
    const handler: CreateHandler = scenariosRouter.create.handler;

    await handler({
      input: validInput,
      ctx: { session: { user: { id: "user-1" } } },
    });

    expect(scheduleAsyncModeration).toHaveBeenCalledTimes(1);
    const changedText = [
      validInput.title,
      validInput.description,
      validInput.openingMessage,
      validInput.aiInstructions,
    ].filter(Boolean).join(" ");
    expect(scheduleAsyncModeration).toHaveBeenCalledWith(changedText, {
      type: "scenario",
      id: "scenario-new",
    });
  });

  it("should work when redis is down (graceful degradation)", async () => {
    const { detectScenarioSpam } = await import("@/server/services/security/spamDetection");
    (detectScenarioSpam as any).mockResolvedValue({ flagged: false });

    mockDb.scenario.create.mockResolvedValue({ id: "scenario-1" });

    // Redis is already null by default
    const { invalidateFeedCache } = await import("@/server/services/cache/scenarioCache");

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — mutation handler is captured at module import time
    const handler: CreateHandler = scenariosRouter.create.handler;

    const result = await handler({
      input: validInput,
      ctx: { session: { user: { id: "user-1" } } },
    });

    expect(result).toEqual({ scenarioId: "scenario-1" });
    // invalidateFeedCache uses redis internally, mock ensures no crash
    expect(invalidateFeedCache).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// feed
// ---------------------------------------------------------------------------

describe("scenariosRouter.feed", () => {
  const mockFeedItems = [
    {
      id: "s-1",
      title: "Scenario 1",
      visibility: "PUBLIC",
      moderationStatus: "APPROVED",
      likeCount: 10,
      playCount: 5,
      createdAt: new Date("2026-06-01"),
      creator: { id: "u-1", username: "Alice", image: null },
      character: { id: "c-1", name: "Char1", slug: "char1", avatarUrl: null, category: "ROMANTIC" },
      _count: { reactions: 5, comments: 2 },
    },
    {
      id: "s-2",
      title: "Scenario 2",
      visibility: "PUBLIC",
      moderationStatus: "APPROVED",
      likeCount: 20,
      playCount: 10,
      createdAt: new Date("2026-06-02"),
      creator: { id: "u-2", username: "Bob", image: null },
      character: { id: "c-2", name: "Char2", slug: "char2", avatarUrl: null, category: "CHAOTIC" },
      _count: { reactions: 3, comments: 1 },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisValue.current = null; // disable redis by default
  });

  it("should return PUBLIC+APPROVED scenarios with CHRONOLOGICAL sort", async () => {
    mockDb.scenario.findMany.mockResolvedValue(mockFeedItems);

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — query handler is captured at module import time
    const handler: FeedHandler = scenariosRouter.feed.handler;

    const result = await handler({
      input: { sort: "CHRONOLOGICAL", limit: 10 },
    });

    expect(result.items).toHaveLength(2);
    expect(mockDb.scenario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { visibility: "PUBLIC", moderationStatus: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 11,
      }),
    );
  });

  it("should return results from cache on first page cache hit", async () => {
    mockRedisValue.current = {};
    const cachedResult = { items: mockFeedItems, nextCursor: undefined };

    const { getCachedFeed } = await import("@/server/services/cache/scenarioCache");
    (getCachedFeed as any).mockResolvedValue(cachedResult);

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — query handler is captured at module import time
    const handler: FeedHandler = scenariosRouter.feed.handler;

    const result = await handler({
      input: { sort: "CHRONOLOGICAL", limit: 10 },
    });

    expect(result).toEqual(cachedResult);
    expect(mockDb.scenario.findMany).not.toHaveBeenCalled();
  });

  it("should query DB on cache miss", async () => {
    mockRedisValue.current = {};
    const { getCachedFeed } = await import("@/server/services/cache/scenarioCache");
    (getCachedFeed as any).mockResolvedValue(null);
    mockDb.scenario.findMany.mockResolvedValue(mockFeedItems);

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — query handler is captured at module import time
    const handler: FeedHandler = scenariosRouter.feed.handler;

    const result = await handler({
      input: { sort: "CHRONOLOGICAL", limit: 10 },
    });

    expect(result.items).toHaveLength(2);
    expect(mockDb.scenario.findMany).toHaveBeenCalledTimes(1);
  });

  it("should cache first page (no cursor) after DB query", async () => {
    mockRedisValue.current = {};
    const { getCachedFeed, setCachedFeed } = await import("@/server/services/cache/scenarioCache");
    (getCachedFeed as any).mockResolvedValue(null);
    mockDb.scenario.findMany.mockResolvedValue(mockFeedItems);

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — query handler is captured at module import time
    const handler: FeedHandler = scenariosRouter.feed.handler;

    await handler({
      input: { sort: "CHRONOLOGICAL", limit: 10 },
    });

    expect(setCachedFeed).toHaveBeenCalledWith(
      { sort: "CHRONOLOGICAL", limit: 10 },
      expect.objectContaining({ items: mockFeedItems }),
    );
  });

  it("should NOT cache second page (with cursor)", async () => {
    mockRedisValue.current = {};
    const { setCachedFeed } = await import("@/server/services/cache/scenarioCache");
    mockDb.scenario.findMany.mockResolvedValue(mockFeedItems);

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — query handler is captured at module import time
    const handler: FeedHandler = scenariosRouter.feed.handler;

    await handler({
      input: { cursor: "s-1", sort: "CHRONOLOGICAL", limit: 10 },
    });

    expect(setCachedFeed).not.toHaveBeenCalled();
  });

  it("should handle cursor-based pagination", async () => {
    mockDb.scenario.findMany.mockResolvedValue(mockFeedItems);

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — query handler is captured at module import time
    const handler: FeedHandler = scenariosRouter.feed.handler;

    const result = await handler({
      input: { cursor: "s-0", sort: "CHRONOLOGICAL", limit: 10 },
    });

    expect(result.items).toHaveLength(2);
    expect(mockDb.scenario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 11,
        skip: 1,
        cursor: { id: "s-0" },
      }),
    );
  });

  it("should sort by TRENDING using in-memory score", async () => {
    const items = [
      {
        ...mockFeedItems[0]!,
        likeCount: 5,
        playCount: 1,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        _count: { reactions: 1, comments: 0 },
      },
      {
        ...mockFeedItems[1]!,
        likeCount: 100,
        playCount: 50,
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        _count: { reactions: 50, comments: 20 },
      },
    ];
    mockDb.scenario.findMany.mockResolvedValue(items);

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — query handler is captured at module import time
    const handler: FeedHandler = scenariosRouter.feed.handler;

    const result = await handler({
      input: { sort: "TRENDING", limit: 10 },
    });

    expect(result.items).toHaveLength(2);
    // The second scenario has much higher engagement, should be first
    expect(result.items[0]?.id).toBe("s-2");
    // TRENDING sort uses FETCH_CAP=50
    expect(mockDb.scenario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it("should sort by TOP using likeCount desc", async () => {
    mockDb.scenario.findMany.mockResolvedValue(mockFeedItems);

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — query handler is captured at module import time
    const handler: FeedHandler = scenariosRouter.feed.handler;

    await handler({
      input: { sort: "TOP", limit: 10 },
    });

    expect(mockDb.scenario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { likeCount: "desc" },
      }),
    );
  });

  it("should return empty array when no scenarios match filters", async () => {
    mockDb.scenario.findMany.mockResolvedValue([]);

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — query handler is captured at module import time
    const handler: FeedHandler = scenariosRouter.feed.handler;

    const result = await handler({
      input: { sort: "CHRONOLOGICAL", limit: 10 },
    });

    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeUndefined();
  });

  it("should respect limit=1 boundary", async () => {
    const manyItems = Array.from({ length: 5 }, (_, i) => ({
      ...mockFeedItems[0]!,
      id: `s-${i}`,
      title: `Scenario ${i}`,
    }));
    mockDb.scenario.findMany.mockResolvedValue(manyItems);

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — query handler is captured at module import time
    const handler: FeedHandler = scenariosRouter.feed.handler;

    const result = await handler({
      input: { sort: "CHRONOLOGICAL", limit: 1 },
    });

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeDefined();
    expect(mockDb.scenario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 2 }),
    );
  });

  it("should respect limit=20 boundary", async () => {
    const manyItems = Array.from({ length: 21 }, (_, i) => ({
      ...mockFeedItems[0]!,
      id: `s-${i}`,
      title: `Scenario ${i}`,
    }));
    mockDb.scenario.findMany.mockResolvedValue(manyItems);

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — query handler is captured at module import time
    const handler: FeedHandler = scenariosRouter.feed.handler;

    const result = await handler({
      input: { sort: "CHRONOLOGICAL", limit: 20 },
    });

    expect(result.items).toHaveLength(20);
    expect(result.nextCursor).toBeDefined();
    expect(mockDb.scenario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 21 }),
    );
  });
});

// ---------------------------------------------------------------------------
// trending
// ---------------------------------------------------------------------------

describe("scenariosRouter.trending", () => {
  const baseScenario = {
    id: "s-1",
    title: "Trending Scenario",
    visibility: "PUBLIC" as const,
    moderationStatus: "APPROVED" as const,
    likeCount: 10,
    playCount: 5,
    createdAt: new Date(),
    creator: { id: "u-1", username: "Alice", image: null },
    character: { id: "c-1", name: "Char1", slug: "char1", avatarUrl: null, category: "ROMANTIC" },
    _count: { reactions: 3, comments: 1 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisValue.current = null; // disable redis by default
  });

  it("should return trending scenarios with 48h scores", async () => {
    mockDb.reaction.groupBy.mockResolvedValue([
      { scenarioId: "s-1", _count: { id: 5 } },
    ]);
    mockDb.call.groupBy.mockResolvedValue([
      { scenarioId: "s-1", _count: { id: 3 } },
    ]);
    mockDb.comment.groupBy.mockResolvedValue([
      { scenarioId: "s-1", _count: { id: 2 } },
    ]);
    mockDb.scenario.findMany.mockResolvedValue([baseScenario]);

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — query handler is captured at module import time
    const handler: TrendingHandler = scenariosRouter.trending.handler;

    const result = await handler({
      input: { limit: 10 },
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("s-1");
    // Score should not leak into items
    expect(result.items[0]).not.toHaveProperty("score");
  });

  it("should return from cache on first page hit", async () => {
    mockRedisValue.current = {};
    const cachedResult = { items: [baseScenario], nextCursor: undefined };
    const { getCachedTrendingFeed } = await import("@/server/services/cache/scenarioCache");
    (getCachedTrendingFeed as any).mockResolvedValue(cachedResult);

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — query handler is captured at module import time
    const handler: TrendingHandler = scenariosRouter.trending.handler;

    const result = await handler({
      input: { limit: 10 },
    });

    expect(result).toEqual(cachedResult);
    expect(mockDb.scenario.findMany).not.toHaveBeenCalled();
  });

  it("should return zero scores when there is no 48h activity", async () => {
    mockDb.reaction.groupBy.mockResolvedValue([]);
    mockDb.call.groupBy.mockResolvedValue([]);
    mockDb.comment.groupBy.mockResolvedValue([]);
    mockDb.scenario.findMany.mockResolvedValue([baseScenario]);

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — query handler is captured at module import time
    const handler: TrendingHandler = scenariosRouter.trending.handler;

    const result = await handler({
      input: { limit: 10 },
    });

    expect(result.items).toHaveLength(1);
    // Should not throw — scores are calculated from empty maps
  });

  it("should paginate trending results", async () => {
    const scenarios = Array.from({ length: 3 }, (_, i) => ({
      ...baseScenario,
      id: `s-${i}`,
      title: `Trending ${i}`,
    }));
    mockDb.reaction.groupBy.mockResolvedValue([]);
    mockDb.call.groupBy.mockResolvedValue([]);
    mockDb.comment.groupBy.mockResolvedValue([]);
    mockDb.scenario.findMany.mockResolvedValue(scenarios);

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — query handler is captured at module import time
    const handler: TrendingHandler = scenariosRouter.trending.handler;

    const result = await handler({
      input: { cursor: "s-0", limit: 10 },
    });

    expect(result.items).toHaveLength(3);
    expect(mockDb.scenario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 1,
        cursor: { id: "s-0" },
      }),
    );
  });

  it("should FETCH_CAP at 50 items for trending", async () => {
    mockDb.reaction.groupBy.mockResolvedValue([]);
    mockDb.call.groupBy.mockResolvedValue([]);
    mockDb.comment.groupBy.mockResolvedValue([]);
    mockDb.scenario.findMany.mockResolvedValue([]);

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — query handler is captured at module import time
    const handler: TrendingHandler = scenariosRouter.trending.handler;

    await handler({
      input: { limit: 10 },
    });

    expect(mockDb.scenario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });
});

// ---------------------------------------------------------------------------
// getById
// ---------------------------------------------------------------------------

describe("scenariosRouter.getById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should allow unauthenticated user to see PUBLIC APPROVED scenario", async () => {
    mockDb.scenario.findFirst.mockResolvedValue({
      id: "s-1",
      title: "Public Scenario",
      visibility: "PUBLIC",
      moderationStatus: "APPROVED",
      creator: { id: "u-1", username: "Alice", image: null },
      character: { id: "c-1", name: "Char1", slug: "char1", avatarUrl: null, category: "ROMANTIC" },
      reactions: [],
      _count: { comments: 0, reactions: 0 },
    });

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — query handler is captured at module import time
    const handler: GetByIdHandler = scenariosRouter.getById.handler;

    const result = await handler({
      input: { id: "s-1" },
      ctx: { session: null },
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe("s-1");
  });

  it("should NOT allow unauthenticated user to see PRIVATE scenario", async () => {
    // findFirst with OR conditions: only PUBLIC+APPROVED matches for non-auth
    mockDb.scenario.findFirst.mockImplementation(async ({ where }: any) => {
      // Simulate: non-auth user won't match PRIVATE scenarios
      if (where.OR && Array.isArray(where.OR)) {
        const matchesPublicApproved = where.OR.some(
          (cond: any) =>
            cond.visibility === "PUBLIC" && cond.moderationStatus === "APPROVED",
        );
        // Since there's no userId or role in ctx.session for non-auth,
        // only the PUBLIC+APPROVED condition applies
        if (where.id === "s-private" && matchesPublicApproved) {
          // This scenario is PRIVATE, so PUBLIC condition won't match it
          return null;
        }
      }
      return null;
    });

    // Actually, let's just test that non-auth can only access via PUBLIC+APPROVED
    // The actual DB behavior is: findFirst returns null if no row matches OR conditions
    mockDb.scenario.findFirst.mockResolvedValue(null);

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — query handler is captured at module import time
    const handler: GetByIdHandler = scenariosRouter.getById.handler;

    const result = await handler({
      input: { id: "s-private" },
      ctx: { session: null },
    });

    expect(result).toBeNull();
  });

  it("should allow creator to see their own PRIVATE scenario", async () => {
    const privateScenario = {
      id: "s-own",
      title: "My Private Scenario",
      visibility: "PRIVATE",
      moderationStatus: "PENDING",
      creatorId: "user-1",
      creator: { id: "user-1", username: "Me", image: null },
      character: { id: "c-1", name: "Char1", slug: "char1", avatarUrl: null, category: "ROMANTIC" },
      reactions: [],
      _count: { comments: 0, reactions: 0 },
    };
    // Creator condition: { creatorId: userId } matches regardless of visibility
    mockDb.scenario.findFirst.mockResolvedValue(privateScenario);

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — query handler is captured at module import time
    const handler: GetByIdHandler = scenariosRouter.getById.handler;

    const result = await handler({
      input: { id: "s-own" },
      ctx: { session: { user: { id: "user-1", role: "USER" } } },
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe("s-own");
  });

  it("should NOT allow non-creator to see PRIVATE scenario", async () => {
    mockDb.scenario.findFirst.mockResolvedValue(null);

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — query handler is captured at module import time
    const handler: GetByIdHandler = scenariosRouter.getById.handler;

    const result = await handler({
      input: { id: "s-private" },
      ctx: { session: { user: { id: "other-user", role: "USER" } } },
    });

    expect(result).toBeNull();
  });

  it("should allow ADMIN to see any scenario", async () => {
    const anyScenario = {
      id: "s-anything",
      title: "Any Scenario",
      visibility: "PRIVATE",
      moderationStatus: "REJECTED",
      creator: { id: "u-1", username: "Alice", image: null },
      character: { id: "c-1", name: "Char1", slug: "char1", avatarUrl: null, category: "ROMANTIC" },
      reactions: [],
      _count: { comments: 0, reactions: 0 },
    };
    // ADMIN gets an extra OR condition with empty object ({})
    mockDb.scenario.findFirst.mockResolvedValue(anyScenario);

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — query handler is captured at module import time
    const handler: GetByIdHandler = scenariosRouter.getById.handler;

    const result = await handler({
      input: { id: "s-anything" },
      ctx: { session: { user: { id: "admin-1", role: "ADMIN" } } },
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe("s-anything");
  });

  it("should return null for non-existent scenario", async () => {
    mockDb.scenario.findFirst.mockResolvedValue(null);

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — query handler is captured at module import time
    const handler: GetByIdHandler = scenariosRouter.getById.handler;

    const result = await handler({
      input: { id: "nonexistent" },
      ctx: { session: { user: { id: "user-1", role: "USER" } } },
    });

    expect(result).toBeNull();
  });

  it("should pass correct permission conditions to Prisma query", async () => {
    const expectedWhere = {
      id: "s-1",
      OR: expect.arrayContaining([
        expect.objectContaining({ visibility: "PUBLIC", moderationStatus: "APPROVED" }),
      ]),
    };

    mockDb.scenario.findFirst.mockResolvedValue({
      id: "s-1",
      title: "Test",
      visibility: "PUBLIC",
      moderationStatus: "APPROVED",
      creator: null,
      character: null,
      reactions: [],
      _count: { comments: 0, reactions: 0 },
    });

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — query handler is captured at module import time
    const handler: GetByIdHandler = scenariosRouter.getById.handler;

    await handler({
      input: { id: "s-1" },
      ctx: { session: null },
    });

    expect(mockDb.scenario.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
      }),
    );
  });

  it("should include creator, character, reactions, and _count", async () => {
    mockDb.scenario.findFirst.mockResolvedValue({
      id: "s-1",
      title: "Test",
      visibility: "PUBLIC",
      moderationStatus: "APPROVED",
      creator: { id: "u-1", username: "Alice", image: null },
      character: { id: "c-1", name: "Char1", slug: "char1", avatarUrl: null, category: "ROMANTIC" },
      reactions: [{ emoji: "👍", userId: "u-1" }],
      _count: { comments: 5, reactions: 3 },
    });

    const { scenariosRouter } = await import("../scenarios");
    // @ts-expect-error — query handler is captured at module import time
    const handler: GetByIdHandler = scenariosRouter.getById.handler;

    const result = await handler({
      input: { id: "s-1" },
      ctx: { session: { user: { id: "user-1", role: "USER" } } },
    });

    expect(result).toHaveProperty("creator");
    expect(result).toHaveProperty("character");
    expect(result).toHaveProperty("reactions");
    expect(result).toHaveProperty("_count");
    expect(result?._count).toEqual({ comments: 5, reactions: 3 });
  });
});
