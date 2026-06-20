import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// scenariosV1Router tests — create, feed, getById
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

vi.mock("@/server/services/ai/asyncModeration", () => ({
  scheduleAsyncModeration: vi.fn(),
}));

vi.mock("@/server/services/cache/scenarioCache", () => ({
  getCachedFeed: vi.fn(),
  setCachedFeed: vi.fn(),
  invalidateFeedCache: vi.fn(),
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock procedures module (v1 routers import from "../../procedures")
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
    withContentModeration: vi.fn(() => (opts: { next: Function }) => opts.next()),
    withTracing: vi.fn(() => chain),
    isAuthenticated: chain,
    isAdmin: chain,
    withREDMetrics: vi.fn(() => (opts: { next: Function }) => opts.next()),
  };
});

vi.mock("@/server/middleware/metrics", () => ({
  withREDMetrics: vi.fn(() => (opts: { next: Function }) => opts.next()),
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

type GetByIdInput = {
  input: { id: string };
  ctx: { session?: { user?: { id: string; role?: string } } | null };
};
type GetByIdHandler = (opts: GetByIdInput) => Promise<unknown>;

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------
describe("scenariosV1Router.create", () => {
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
    mockDb.scenario.create.mockResolvedValue({ id: "scenario-new" });

    const { scenariosV1Router } = await import("../scenarios");
    const handler: CreateHandler = (scenariosV1Router as any).create.handler;

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
    mockDb.scenario.create.mockResolvedValue({ id: "scenario-new" });

    const { scenariosV1Router } = await import("../scenarios");
    const handler: CreateHandler = (scenariosV1Router as any).create.handler;

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
  });

  it("should call invalidateFeedCache after creation", async () => {
    mockDb.scenario.create.mockResolvedValue({ id: "scenario-new" });

    const { invalidateFeedCache } = await import("@/server/services/cache/scenarioCache");
    const { scenariosV1Router } = await import("../scenarios");
    const handler: CreateHandler = (scenariosV1Router as any).create.handler;

    await handler({
      input: validInput,
      ctx: { session: { user: { id: "user-1" } } },
    });

    expect(invalidateFeedCache).toHaveBeenCalledTimes(1);
  });

  it("should trigger async moderation after creation", async () => {
    mockDb.scenario.create.mockResolvedValue({ id: "scenario-new" });

    const { scheduleAsyncModeration } = await import("@/server/services/ai/asyncModeration");
    const { scenariosV1Router } = await import("../scenarios");
    const handler: CreateHandler = (scenariosV1Router as any).create.handler;

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
});

// ---------------------------------------------------------------------------
// feed
// ---------------------------------------------------------------------------
describe("scenariosV1Router.feed", () => {
  const mockFeedItems = [
    {
      id: "s-1",
      title: "Scenario 1",
      visibility: "PUBLIC" as const,
      moderationStatus: "APPROVED" as const,
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
      visibility: "PUBLIC" as const,
      moderationStatus: "APPROVED" as const,
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
    mockRedisValue.current = null;
  });

  it("should return PUBLIC+APPROVED scenarios with CHRONOLOGICAL sort", async () => {
    mockDb.scenario.findMany.mockResolvedValue(mockFeedItems);

    const { scenariosV1Router } = await import("../scenarios");
    const handler: FeedHandler = (scenariosV1Router as any).feed.handler;

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

    const { scenariosV1Router } = await import("../scenarios");
    const handler: FeedHandler = (scenariosV1Router as any).feed.handler;

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

    const { scenariosV1Router } = await import("../scenarios");
    const handler: FeedHandler = (scenariosV1Router as any).feed.handler;

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

    const { scenariosV1Router } = await import("../scenarios");
    const handler: FeedHandler = (scenariosV1Router as any).feed.handler;

    await handler({ input: { sort: "CHRONOLOGICAL", limit: 10 } });

    expect(setCachedFeed).toHaveBeenCalledWith(
      { sort: "CHRONOLOGICAL", limit: 10 },
      expect.objectContaining({ items: mockFeedItems }),
    );
  });

  it("should handle cursor-based pagination", async () => {
    mockDb.scenario.findMany.mockResolvedValue(mockFeedItems);

    const { scenariosV1Router } = await import("../scenarios");
    const handler: FeedHandler = (scenariosV1Router as any).feed.handler;

    const result = await handler({
      input: { cursor: "s-0", sort: "CHRONOLOGICAL", limit: 10 },
    });

    expect(result.items).toHaveLength(2);
    expect(mockDb.scenario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 11, skip: 1, cursor: { id: "s-0" } }),
    );
  });

  it("should sort by TRENDING using in-memory score", async () => {
    const items = [
      {
        ...mockFeedItems[0]!,
        likeCount: 5,
        playCount: 1,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        _count: { reactions: 1, comments: 0 },
      },
      {
        ...mockFeedItems[1]!,
        likeCount: 100,
        playCount: 50,
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        _count: { reactions: 50, comments: 20 },
      },
    ];
    mockDb.scenario.findMany.mockResolvedValue(items);

    const { scenariosV1Router } = await import("../scenarios");
    const handler: FeedHandler = (scenariosV1Router as any).feed.handler;

    const result = await handler({ input: { sort: "TRENDING", limit: 10 } });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.id).toBe("s-2");
    expect(mockDb.scenario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it("should sort by TOP using likeCount desc", async () => {
    mockDb.scenario.findMany.mockResolvedValue(mockFeedItems);

    const { scenariosV1Router } = await import("../scenarios");
    const handler: FeedHandler = (scenariosV1Router as any).feed.handler;

    await handler({ input: { sort: "TOP", limit: 10 } });

    expect(mockDb.scenario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { likeCount: "desc" } }),
    );
  });

  it("should return empty array when no scenarios match filters", async () => {
    mockDb.scenario.findMany.mockResolvedValue([]);

    const { scenariosV1Router } = await import("../scenarios");
    const handler: FeedHandler = (scenariosV1Router as any).feed.handler;

    const result = await handler({ input: { sort: "CHRONOLOGICAL", limit: 10 } });

    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getById
// ---------------------------------------------------------------------------
describe("scenariosV1Router.getById", () => {
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

    const { scenariosV1Router } = await import("../scenarios");
    const handler: GetByIdHandler = (scenariosV1Router as any).getById.handler;

    const result = await handler({
      input: { id: "s-1" },
      ctx: { session: null },
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe("s-1");
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
    mockDb.scenario.findFirst.mockResolvedValue(privateScenario);

    const { scenariosV1Router } = await import("../scenarios");
    const handler: GetByIdHandler = (scenariosV1Router as any).getById.handler;

    const result = await handler({
      input: { id: "s-own" },
      ctx: { session: { user: { id: "user-1", role: "USER" } } },
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe("s-own");
  });

  it("should NOT allow non-creator to see PRIVATE scenario", async () => {
    mockDb.scenario.findFirst.mockResolvedValue(null);

    const { scenariosV1Router } = await import("../scenarios");
    const handler: GetByIdHandler = (scenariosV1Router as any).getById.handler;

    const result = await handler({
      input: { id: "s-private" },
      ctx: { session: { user: { id: "other-user", role: "USER" } } },
    });

    expect(result).toBeNull();
  });

  it("should allow ADMIN to see any scenario", async () => {
    mockDb.scenario.findFirst.mockResolvedValue({
      id: "s-anything",
      title: "Any Scenario",
      visibility: "PRIVATE",
      moderationStatus: "REJECTED",
      creator: { id: "u-1", username: "Alice", image: null },
      character: { id: "c-1", name: "Char1", slug: "char1", avatarUrl: null, category: "ROMANTIC" },
      reactions: [],
      _count: { comments: 0, reactions: 0 },
    });

    const { scenariosV1Router } = await import("../scenarios");
    const handler: GetByIdHandler = (scenariosV1Router as any).getById.handler;

    const result = await handler({
      input: { id: "s-anything" },
      ctx: { session: { user: { id: "admin-1", role: "ADMIN" } } },
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe("s-anything");
  });

  it("should return null for non-existent scenario", async () => {
    mockDb.scenario.findFirst.mockResolvedValue(null);

    const { scenariosV1Router } = await import("../scenarios");
    const handler: GetByIdHandler = (scenariosV1Router as any).getById.handler;

    const result = await handler({
      input: { id: "nonexistent" },
      ctx: { session: { user: { id: "user-1", role: "USER" } } },
    });

    expect(result).toBeNull();
  });

  it("should pass correct permission conditions to Prisma query", async () => {
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

    const { scenariosV1Router } = await import("../scenarios");
    const handler: GetByIdHandler = (scenariosV1Router as any).getById.handler;

    await handler({
      input: { id: "s-1" },
      ctx: { session: null },
    });

    expect(mockDb.scenario.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "s-1",
          OR: expect.arrayContaining([
            expect.objectContaining({ visibility: "PUBLIC", moderationStatus: "APPROVED" }),
          ]),
        }),
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

    const { scenariosV1Router } = await import("../scenarios");
    const handler: GetByIdHandler = (scenariosV1Router as any).getById.handler;

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
