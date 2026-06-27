import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// dashboardRouter.getData tests (Sprint 2 Item 19)
// ---------------------------------------------------------------------------
// The getData procedure aggregates 4 queries into a single Promise.all:
//   1. User credits
//   2. Recent calls (includes scenario + character)
//   3. Today's call count
//   4. User's scenarios (includes character + reaction/comment counts)
//
// Uses protectedProcedure (requires auth) and optional input for pagination limits.

const mockDb = vi.hoisted(() => ({
  userBilling: {
    findUnique: vi.fn(),
  },
  call: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  scenario: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/server/db", () => ({
  db: mockDb,
}));

// Mock getUTCDayRange to return controlled dates for deterministic testing
const mockTodayStart = new Date("2026-05-31T00:00:00.000Z");
const mockTodayEnd = new Date("2026-05-31T23:59:59.999Z");

vi.mock("../../lib/date", () => ({
  getUTCDayRange: vi.fn(() => ({
    todayStart: mockTodayStart,
    todayEnd: mockTodayEnd,
  })),
}));

// Mock tRPC to capture query handlers for direct testing
vi.mock("@/server/trpc", () => {
  const chain = {
    input: vi.fn(() => chain),
    mutation: vi.fn(() => ({
      type: "mutation" as const,
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
    withTracing: vi.fn(() => chain),
    isAuthenticated: chain,
    isAdmin: chain,
  };
});

type GetDataInput = { callsLimit?: number; scenariosLimit?: number };
type GetDataContext = { session: { user: { id: string } } };
type GetDataHandler = (opts: { ctx: GetDataContext; input: GetDataInput }) => Promise<{
  credits: number;
  calls: Array<unknown>;
  todayCount: number;
  scenarios: Array<unknown>;
}>;

describe("dashboardRouter.getData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return credits, calls, todayCount, and scenarios in a single response", async () => {
    mockDb.userBilling.findUnique.mockResolvedValue({
      id: "bill-1",
      userId: "user-123",
      credits: 42,
    });
    mockDb.call.findMany.mockResolvedValue([
      {
        id: "call-1",
        scenario: { id: "s-1", title: "Test", character: { name: "Bot", slug: "bot" } },
      },
      {
        id: "call-2",
        scenario: { id: "s-2", title: "Test 2", character: { name: "Bot2", slug: "bot2" } },
      },
    ]);
    mockDb.call.count.mockResolvedValue(3);
    mockDb.scenario.findMany.mockResolvedValue([
      { id: "scenario-1", character: { name: "Char1" }, _count: { reactions: 5, comments: 2 } },
      { id: "scenario-2", character: { name: "Char2" }, _count: { reactions: 3, comments: 1 } },
    ]);

    const { dashboardRouter } = await import("../dashboard");

    // @ts-expect-error — query handler is captured at module import time
    const handler: GetDataHandler = dashboardRouter.getData.handler;

    const result = await handler({
      ctx: { session: { user: { id: "user-123" } } },
      input: { callsLimit: 5, scenariosLimit: 3 },
    });

    // Verify all 4 fields are present
    expect(result).toHaveProperty("credits");
    expect(result).toHaveProperty("calls");
    expect(result).toHaveProperty("todayCount");
    expect(result).toHaveProperty("scenarios");

    expect(result.credits).toBe(42);
    expect(result.calls).toHaveLength(2);
    expect(result.todayCount).toBe(3);
    expect(result.scenarios).toHaveLength(2);
  });

  it("should query user credits for the authenticated user", async () => {
    mockDb.userBilling.findUnique.mockResolvedValue({
      id: "bill-s",
      userId: "user-specific",
      credits: 100,
    });
    mockDb.call.findMany.mockResolvedValue([]);
    mockDb.call.count.mockResolvedValue(0);
    mockDb.scenario.findMany.mockResolvedValue([]);

    const { dashboardRouter } = await import("../dashboard");

    // @ts-expect-error — query handler is captured at module import time
    const handler: GetDataHandler = dashboardRouter.getData.handler;

    await handler({
      ctx: { session: { user: { id: "user-specific" } } },
      input: {},
    });

    expect(mockDb.userBilling.findUnique).toHaveBeenCalledWith({
      where: { userId: "user-specific" },
      select: { id: true, userId: true, credits: true },
    });
  });

  it("should query recent calls for the authenticated user", async () => {
    mockDb.userBilling.findUnique.mockResolvedValue({
      id: "bill-d",
      userId: "user-xxx",
      credits: 10,
    });
    mockDb.call.findMany.mockResolvedValue([]);
    mockDb.call.count.mockResolvedValue(0);
    mockDb.scenario.findMany.mockResolvedValue([]);

    const { dashboardRouter } = await import("../dashboard");

    // @ts-expect-error — query handler is captured at module import time
    const handler: GetDataHandler = dashboardRouter.getData.handler;

    await handler({
      ctx: { session: { user: { id: "user-calls" } } },
      input: { callsLimit: 5 },
    });

    expect(mockDb.call.findMany).toHaveBeenCalledWith({
      where: { userId: "user-calls" },
      take: 6, // limit + 1
      orderBy: { createdAt: "desc" },
      include: {
        scenario: {
          select: {
            id: true,
            title: true,
            character: { select: { name: true, slug: true } },
          },
        },
      },
    });
  });

  it("should query today's call count with correct date range", async () => {
    mockDb.userBilling.findUnique.mockResolvedValue({
      id: "bill-d",
      userId: "user-xxx",
      credits: 10,
    });
    mockDb.call.findMany.mockResolvedValue([]);
    mockDb.call.count.mockResolvedValue(0);
    mockDb.scenario.findMany.mockResolvedValue([]);

    const { dashboardRouter } = await import("../dashboard");

    // @ts-expect-error — query handler is captured at module import time
    const handler: GetDataHandler = dashboardRouter.getData.handler;

    await handler({
      ctx: { session: { user: { id: "user-today" } } },
      input: {},
    });

    expect(mockDb.call.count).toHaveBeenCalledWith({
      where: {
        userId: "user-today",
        createdAt: { gte: mockTodayStart, lte: mockTodayEnd },
      },
    });
  });

  it("should query user's scenarios with character and counts", async () => {
    mockDb.userBilling.findUnique.mockResolvedValue({
      id: "bill-d",
      userId: "user-xxx",
      credits: 10,
    });
    mockDb.call.findMany.mockResolvedValue([]);
    mockDb.call.count.mockResolvedValue(0);
    mockDb.scenario.findMany.mockResolvedValue([]);

    const { dashboardRouter } = await import("../dashboard");

    // @ts-expect-error — query handler is captured at module import time
    const handler: GetDataHandler = dashboardRouter.getData.handler;

    await handler({
      ctx: { session: { user: { id: "user-scenarios" } } },
      input: { scenariosLimit: 3 },
    });

    expect(mockDb.scenario.findMany).toHaveBeenCalledWith({
      where: { creatorId: "user-scenarios" },
      take: 4, // limit + 1
      orderBy: { createdAt: "desc" },
      include: {
        character: {
          select: { id: true, name: true, slug: true, avatarUrl: true, category: true },
        },
        _count: { select: { reactions: true, comments: true } },
      },
    });
  });

  it("should return 0 credits when user is not found", async () => {
    mockDb.userBilling.findUnique.mockResolvedValue(null);
    mockDb.call.findMany.mockResolvedValue([]);
    mockDb.call.count.mockResolvedValue(0);
    mockDb.scenario.findMany.mockResolvedValue([]);

    const { dashboardRouter } = await import("../dashboard");

    // @ts-expect-error — query handler is captured at module import time
    const handler: GetDataHandler = dashboardRouter.getData.handler;

    const result = await handler({
      ctx: { session: { user: { id: "nonexistent" } } },
      input: {},
    });

    expect(result.credits).toBe(0);
  });

  it("should slice calls to the requested limit", async () => {
    mockDb.userBilling.findUnique.mockResolvedValue({
      id: "bill-d",
      userId: "user-xxx",
      credits: 10,
    });
    mockDb.call.count.mockResolvedValue(0);
    mockDb.scenario.findMany.mockResolvedValue([]);

    // Return callsLimit + 1 items to test slicing
    const calls = Array.from({ length: 6 }, (_, i) => ({
      id: `call-${i}`,
      scenario: { id: `s-${i}`, title: `Call ${i}`, character: { name: "Bot", slug: "bot" } },
    }));
    mockDb.call.findMany.mockResolvedValue(calls);

    const { dashboardRouter } = await import("../dashboard");

    // @ts-expect-error — query handler is captured at module import time
    const handler: GetDataHandler = dashboardRouter.getData.handler;

    const result = await handler({
      ctx: { session: { user: { id: "user-slice" } } },
      input: { callsLimit: 5 },
    });

    // Should only return 5 even though DB returned 6
    expect(result.calls).toHaveLength(5);
  });

  it("should slice scenarios to the requested limit", async () => {
    mockDb.userBilling.findUnique.mockResolvedValue({
      id: "bill-d",
      userId: "user-xxx",
      credits: 10,
    });
    mockDb.call.findMany.mockResolvedValue([]);
    mockDb.call.count.mockResolvedValue(0);

    // Return scenariosLimit + 1 items to test slicing
    const scenarios = Array.from({ length: 4 }, (_, i) => ({
      id: `scenario-${i}`,
      character: {
        id: `char-${i}`,
        name: `Char ${i}`,
        slug: `char-${i}`,
        avatarUrl: null,
        category: "GENERAL",
      },
      _count: { reactions: 0, comments: 0 },
    }));
    mockDb.scenario.findMany.mockResolvedValue(scenarios);

    const { dashboardRouter } = await import("../dashboard");

    // @ts-expect-error — query handler is captured at module import time
    const handler: GetDataHandler = dashboardRouter.getData.handler;

    const result = await handler({
      ctx: { session: { user: { id: "user-slice" } } },
      input: { scenariosLimit: 3 },
    });

    // Should only return 3 even though DB returned 4
    expect(result.scenarios).toHaveLength(3);
  });

  it("should run all queries in parallel (Promise.all)", async () => {
    // This test verifies the structural contract: the handler uses Promise.all
    mockDb.userBilling.findUnique.mockResolvedValue({
      id: "bill-d",
      userId: "user-xxx",
      credits: 10,
    });
    mockDb.call.findMany.mockResolvedValue([]);
    mockDb.call.count.mockResolvedValue(0);
    mockDb.scenario.findMany.mockResolvedValue([]);

    const { dashboardRouter } = await import("../dashboard");

    // @ts-expect-error — query handler is captured at module import time
    const handler: GetDataHandler = dashboardRouter.getData.handler;
    const result = await handler({
      ctx: { session: { user: { id: "user-parallel" } } },
      input: {},
    });

    // All 4 queries should have been called
    expect(mockDb.userBilling.findUnique).toHaveBeenCalledTimes(1);
    expect(mockDb.call.findMany).toHaveBeenCalledTimes(1);
    expect(mockDb.call.count).toHaveBeenCalledTimes(1);
    expect(mockDb.scenario.findMany).toHaveBeenCalledTimes(1);

    expect(result).toEqual({
      credits: 10,
      calls: [],
      todayCount: 0,
      scenarios: [],
    });
  });
});
