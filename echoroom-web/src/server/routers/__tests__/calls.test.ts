import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// callsRouter.todayCount tests
// ---------------------------------------------------------------------------
// Tests the todayCount query procedure that counts user calls for the current
// UTC day. Mocks db, trpc, and date utilities to test the handler directly.

const mockDb = vi.hoisted(() => ({
  call: {
    count: vi.fn(),
  },
}));

vi.mock("@/server/db", () => ({
  db: mockDb,
}));

// Mock getUTCDayRange to return controlled dates for deterministic testing
const mockTodayStart = new Date("2025-06-01T00:00:00.000Z");
const mockTodayEnd = new Date("2025-06-01T23:59:59.999Z");

vi.mock("../../lib/date", () => ({
  getUTCDayRange: vi.fn(() => ({
    todayStart: mockTodayStart,
    todayEnd: mockTodayEnd,
  })),
}));

// Mock callLifecycle to prevent env.ts chain loading (twilio, creditOps, etc.)
vi.mock("../../services/telephony/callLifecycle", () => ({
  initiateCall: vi.fn(),
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

type TodayCountHandler = (opts: {
  ctx: { session: { user: { id: string } } };
  input: Record<string, never>;
}) => Promise<{ count: number }>;

describe("callsRouter.todayCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return the count of calls made today by the authenticated user", async () => {
    mockDb.call.count.mockResolvedValue(5);

    const { callsRouter } = await import("../calls");

    // @ts-expect-error — query handler is captured at module import time
    const handler: TodayCountHandler = callsRouter.todayCount.handler;

    const result = await handler({
      ctx: { session: { user: { id: "user-123" } } },
      input: {},
    });

    expect(result).toEqual({ count: 5 });
  });

  it("should query db.call.count with the user's ID and today's UTC date range", async () => {
    mockDb.call.count.mockResolvedValue(3);

    const { callsRouter } = await import("../calls");

    // @ts-expect-error — query handler is captured at module import time
    const handler: TodayCountHandler = callsRouter.todayCount.handler;

    await handler({
      ctx: { session: { user: { id: "user-456" } } },
      input: {},
    });

    expect(mockDb.call.count).toHaveBeenCalledTimes(1);
    expect(mockDb.call.count).toHaveBeenCalledWith({
      where: {
        userId: "user-456",
        createdAt: { gte: mockTodayStart, lte: mockTodayEnd },
      },
    });
  });

  it("should return 0 when no calls have been made today", async () => {
    mockDb.call.count.mockResolvedValue(0);

    const { callsRouter } = await import("../calls");

    // @ts-expect-error — query handler is captured at module import time
    const handler: TodayCountHandler = callsRouter.todayCount.handler;

    const result = await handler({
      ctx: { session: { user: { id: "user-789" } } },
      input: {},
    });

    expect(result).toEqual({ count: 0 });
  });

  it("should use getUTCDayRange for the date boundaries", async () => {
    mockDb.call.count.mockResolvedValue(2);

    // Import the mocked module to verify it was called
    const { getUTCDayRange } = await import("../../lib/date");
    const { callsRouter } = await import("../calls");

    // @ts-expect-error — query handler is captured at module import time
    const handler: TodayCountHandler = callsRouter.todayCount.handler;

    await handler({
      ctx: { session: { user: { id: "user-101" } } },
      input: {},
    });

    expect(getUTCDayRange).toHaveBeenCalledTimes(1);
  });

  it("should return the correct count for different users independently", async () => {
    mockDb.call.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(7);

    const { callsRouter } = await import("../calls");

    // @ts-expect-error — query handler is captured at module import time
    const handler: TodayCountHandler = callsRouter.todayCount.handler;

    const result1 = await handler({
      ctx: { session: { user: { id: "user-alpha" } } },
      input: {},
    });
    expect(result1).toEqual({ count: 3 });

    const result2 = await handler({
      ctx: { session: { user: { id: "user-beta" } } },
      input: {},
    });
    expect(result2).toEqual({ count: 7 });

    // Each call should pass the respective userId to db.call.count
    expect(mockDb.call.count).toHaveBeenNthCalledWith(1, {
      where: {
        userId: "user-alpha",
        createdAt: { gte: mockTodayStart, lte: mockTodayEnd },
      },
    });
    expect(mockDb.call.count).toHaveBeenNthCalledWith(2, {
      where: {
        userId: "user-beta",
        createdAt: { gte: mockTodayStart, lte: mockTodayEnd },
      },
    });
  });

  it("should handle a large count value correctly", async () => {
    mockDb.call.count.mockResolvedValue(999);

    const { callsRouter } = await import("../calls");

    // @ts-expect-error — query handler is captured at module import time
    const handler: TodayCountHandler = callsRouter.todayCount.handler;

    const result = await handler({
      ctx: { session: { user: { id: "user-power" } } },
      input: {},
    });

    expect(result).toEqual({ count: 999 });
    expect(typeof result.count).toBe("number");
  });
});
