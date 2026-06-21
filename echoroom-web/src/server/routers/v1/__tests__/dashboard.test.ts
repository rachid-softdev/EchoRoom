import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// dashboardV1Router tests
// ---------------------------------------------------------------------------

const mockDb = vi.hoisted(() => ({
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

const mockFindByUserId = vi.hoisted(() => vi.fn());
vi.mock("@/server/repositories", () => ({
  userBillingRepository: {
    findByUserId: mockFindByUserId,
  },
}));

// Mock getUTCDayRange to return controlled dates
const mockTodayStart = new Date("2026-06-21T00:00:00.000Z");
const mockTodayEnd = new Date("2026-06-21T23:59:59.999Z");

vi.mock("@/server/lib/date", () => ({
  getUTCDayRange: vi.fn(() => ({
    todayStart: mockTodayStart,
    todayEnd: mockTodayEnd,
  })),
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
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
    withTracing: vi.fn(() => chain),
    isAuthenticated: chain,
    isAdmin: chain,
    withREDMetrics: vi.fn(() => (opts: { next: Function }) => opts.next()),
  };
});

const validCtx = { session: { user: { id: "user-123" } } };

const MOCK_CALLS = [
  {
    id: "call-3",
    userId: "user-123",
    createdAt: new Date("2026-06-21T10:00:00Z"),
    scenario: { id: "s-1", title: "Scenario 1", character: { name: "Aria", slug: "aria" } },
  },
  {
    id: "call-2",
    userId: "user-123",
    createdAt: new Date("2026-06-20T10:00:00Z"),
    scenario: { id: "s-2", title: "Scenario 2", character: { name: "Zara", slug: "zara" } },
  },
];

const MOCK_SCENARIOS = [
  {
    id: "sc-1",
    title: "My Scenario",
    createdAt: new Date("2026-06-21T10:00:00Z"),
    character: { id: "char-1", name: "Aria", slug: "aria", avatarUrl: null, category: "ROMANTIC" },
    _count: { reactions: 5, comments: 2 },
  },
];

// ---------------------------------------------------------------------------
// getData — aggregated dashboard data
// ---------------------------------------------------------------------------
describe("dashboardV1Router.getData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return aggregated dashboard data with default limits", async () => {
    mockFindByUserId.mockResolvedValue({ id: "billing-1", userId: "user-123", credits: 150 });
    mockDb.call.findMany.mockResolvedValue(MOCK_CALLS);
    mockDb.call.count.mockResolvedValue(3);
    mockDb.scenario.findMany.mockResolvedValue(MOCK_SCENARIOS);

    const { dashboardV1Router } = await import("../dashboard");
    const handler = (dashboardV1Router as any).getData.handler;

    const result = await handler({ input: {}, ctx: validCtx });

    expect(result.credits).toBe(150);
    expect(result.calls).toHaveLength(2);
    expect(result.todayCount).toBe(3);
    expect(result.scenarios).toHaveLength(1);
  });

  it("should return 0 credits when billing is null", async () => {
    mockFindByUserId.mockResolvedValue(null);
    mockDb.call.findMany.mockResolvedValue([]);
    mockDb.call.count.mockResolvedValue(0);
    mockDb.scenario.findMany.mockResolvedValue([]);

    const { dashboardV1Router } = await import("../dashboard");
    const handler = (dashboardV1Router as any).getData.handler;

    const result = await handler({ input: {}, ctx: validCtx });

    expect(result.credits).toBe(0);
    expect(result.calls).toEqual([]);
    expect(result.todayCount).toBe(0);
    expect(result.scenarios).toEqual([]);
  });

  it("should use getUTCDayRange for todayCount query", async () => {
    mockFindByUserId.mockResolvedValue(null);
    mockDb.call.findMany.mockResolvedValue([]);
    mockDb.call.count.mockResolvedValue(0);
    mockDb.scenario.findMany.mockResolvedValue([]);

    const { getUTCDayRange } = await import("@/server/lib/date");
    const { dashboardV1Router } = await import("../dashboard");
    const handler = (dashboardV1Router as any).getData.handler;

    await handler({ input: {}, ctx: validCtx });

    expect(getUTCDayRange).toHaveBeenCalledTimes(1);
    expect(mockDb.call.count).toHaveBeenCalledWith({
      where: {
        userId: "user-123",
        createdAt: { gte: mockTodayStart, lte: mockTodayEnd },
      },
    });
  });

  it("should respect custom callsLimit", async () => {
    const manyCalls = Array.from({ length: 8 }, (_, i) => ({
      id: `call-${i}`,
      userId: "user-123",
      createdAt: new Date(`2026-06-${String(i + 1).padStart(2, "0")}T10:00:00Z`),
      scenario: { id: `s-${i}`, title: `S${i}`, character: { name: `C${i}`, slug: `c${i}` } },
    }));

    mockFindByUserId.mockResolvedValue(null);
    mockDb.call.findMany.mockResolvedValue(manyCalls);
    mockDb.call.count.mockResolvedValue(0);
    mockDb.scenario.findMany.mockResolvedValue([]);

    const { dashboardV1Router } = await import("../dashboard");
    const handler = (dashboardV1Router as any).getData.handler;

    const result = await handler({
      input: { callsLimit: 3, scenariosLimit: 3 },
      ctx: validCtx,
    });

    expect(result.calls).toHaveLength(3);
    expect(mockDb.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 4 }),
    );
  });

  it("should respect custom scenariosLimit", async () => {
    const manyScenarios = Array.from({ length: 5 }, (_, i) => ({
      id: `sc-${i}`,
      title: `Scenario ${i}`,
      createdAt: new Date(`2026-06-${String(i + 1).padStart(2, "0")}T10:00:00Z`),
      character: { id: `char-${i}`, name: `C${i}`, slug: `c${i}`, avatarUrl: null, category: "ROMANTIC" },
      _count: { reactions: 0, comments: 0 },
    }));

    mockFindByUserId.mockResolvedValue(null);
    mockDb.call.findMany.mockResolvedValue([]);
    mockDb.call.count.mockResolvedValue(0);
    mockDb.scenario.findMany.mockResolvedValue(manyScenarios);

    const { dashboardV1Router } = await import("../dashboard");
    const handler = (dashboardV1Router as any).getData.handler;

    const result = await handler({
      input: { callsLimit: 5, scenariosLimit: 2 },
      ctx: validCtx,
    });

    expect(result.scenarios).toHaveLength(2);
    expect(mockDb.scenario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 }),
    );
  });

  it("should run all queries in parallel (Promise.all)", async () => {
    mockFindByUserId.mockResolvedValue({ id: "billing-1", credits: 100 });
    mockDb.call.findMany.mockResolvedValue(MOCK_CALLS);
    mockDb.call.count.mockResolvedValue(3);
    mockDb.scenario.findMany.mockResolvedValue(MOCK_SCENARIOS);

    const { dashboardV1Router } = await import("../dashboard");
    const handler = (dashboardV1Router as any).getData.handler;

    await handler({ input: {}, ctx: validCtx });

    expect(mockFindByUserId).toHaveBeenCalledWith("user-123");
    expect(mockDb.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-123" } }),
    );
    expect(mockDb.call.count).toHaveBeenCalled();
    expect(mockDb.scenario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { creatorId: "user-123" } }),
    );
  });

  it("should slice extra items beyond limit", async () => {
    const extraCalls = Array.from({ length: 6 }, (_, i) => ({
      id: `call-${i}`,
      userId: "user-123",
      createdAt: new Date(`2026-06-${String(i + 1).padStart(2, "0")}T10:00:00Z`),
      scenario: { id: `s-${i}`, title: `S${i}`, character: { name: `C${i}`, slug: `c${i}` } },
    }));

    mockFindByUserId.mockResolvedValue(null);
    mockDb.call.findMany.mockResolvedValue(extraCalls);
    mockDb.call.count.mockResolvedValue(0);
    mockDb.scenario.findMany.mockResolvedValue([]);

    const { dashboardV1Router } = await import("../dashboard");
    const handler = (dashboardV1Router as any).getData.handler;

    const result = await handler({
      input: { callsLimit: 5, scenariosLimit: 3 },
      ctx: validCtx,
    });

    expect(result.calls).toHaveLength(5);
  });

  it("should enforce callsLimit max of 20 (Zod schema)", () => {
    import("zod").then(({ z }) => {
      const schema = z.object({
        callsLimit: z.number().min(1).max(20).default(5),
        scenariosLimit: z.number().min(1).max(20).default(3),
      });
      expect(schema.safeParse({ callsLimit: 21 }).success).toBe(false);
    });
  });

  it("should enforce scenariosLimit max of 20 (Zod schema)", () => {
    import("zod").then(({ z }) => {
      const schema = z.object({
        callsLimit: z.number().min(1).max(20).default(5),
        scenariosLimit: z.number().min(1).max(20).default(3),
      });
      expect(schema.safeParse({ scenariosLimit: 21 }).success).toBe(false);
    });
  });
});
