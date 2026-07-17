import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

// ---------------------------------------------------------------------------
// callsV1Router tests
// ---------------------------------------------------------------------------
// Tests the v1 calls router by mocking @/server/procedures and @/server/db.

const mockDb = vi.hoisted(() => ({
  call: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  blockedNumber: {
    findUnique: vi.fn(),
  },
  scenario: {
    update: vi.fn(),
  },
  userBilling: {
    // tier resolution in calls.start reads UserBilling.plan (defaults to "free")
    findUnique: vi.fn().mockResolvedValue({ plan: undefined }),
  },
}));

const mockRedis = vi.hoisted(() => ({
  keys: vi.fn(),
  del: vi.fn(),
  get: vi.fn<(key: string) => Promise<unknown>>(),
  set: vi.fn(),
}));

const mockDetectCallSpam = vi.hoisted(() => vi.fn());
const mockGetPresignedUrl = vi.hoisted(() => vi.fn());

vi.mock("@/server/db", () => ({
  db: mockDb,
}));

// Mock getUTCDayRange to return controlled dates for deterministic testing
const mockTodayStart = new Date("2025-06-01T00:00:00.000Z");
const mockTodayEnd = new Date("2025-06-01T23:59:59.999Z");

vi.mock("../../../lib/date", () => ({
  getUTCDayRange: vi.fn(() => ({
    todayStart: mockTodayStart,
    todayEnd: mockTodayEnd,
  })),
}));

vi.mock("@/lib/redis", () => ({
  redis: mockRedis,
}));

vi.mock("../../../services/security/spamDetection", () => ({
  detectCallSpam: mockDetectCallSpam,
}));

vi.mock("../../../services/audio/r2", () => ({
  getPresignedUrl: mockGetPresignedUrl,
}));

// Mock callLifecycle to prevent env.ts chain loading
vi.mock("../../../services/telephony/callLifecycle", () => ({
  initiateCall: vi.fn(),
}));

// Mock errors module (source imports AppError from "../../lib/errors")
vi.mock("../../../lib/errors", () => ({
  AppError: class AppError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "AppError";
    }
  },
}));

// Mock middleware/metrics to prevent importing ../trpc → @/lib/auth → next-auth
vi.mock("@/server/middleware/metrics", () => ({
  withREDMetrics: vi.fn(() => (opts: { next: Function }) => opts.next()),
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
    withTracing: vi.fn(() => chain),
    isAuthenticated: chain,
    isAdmin: chain,
    withREDMetrics: vi.fn(() => (opts: { next: Function }) => opts.next()),
  };
});

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Types for handlers
// ---------------------------------------------------------------------------
type TodayCountHandler = (opts: {
  ctx: { session: { user: { id: string } } };
  input: Record<string, never>;
}) => Promise<{ count: number }>;

type StartHandler = (opts: {
  ctx: { session: { user: { id: string } } };
  input: { scenarioId: string; phoneNumber: string; maxDurationSeconds: number };
}) => Promise<{ callId: string; estimatedCredits: number }>;

type HistoryHandler = (opts: {
  ctx: { session: { user: { id: string } } };
  input: { cursor?: string; limit: number };
}) => Promise<{ items: unknown[]; nextCursor: string | undefined }>;

type ListByScenarioHandler = (opts: {
  ctx: { session: { user: { id: string } } };
  input: { scenarioId: string; cursor?: string; limit: number };
}) => Promise<{ items: unknown[]; nextCursor: string | undefined }>;

type ReplayHandler = (opts: {
  ctx: { session: { user: { id: string } } };
  input: { callId: string };
}) => Promise<{ recordingUrl: string | null; transcript: unknown[] | null }>;

// ---------------------------------------------------------------------------
// todayCount
// ---------------------------------------------------------------------------
describe("callsV1Router.todayCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return the count of calls made today by the authenticated user", async () => {
    mockDb.call.count.mockResolvedValue(5);

    const { callsV1Router } = await import("../calls");
    const handler: TodayCountHandler = (callsV1Router as any).todayCount.handler;

    const result = await handler({
      ctx: { session: { user: { id: "user-123" } } },
      input: {},
    });

    expect(result).toEqual({ count: 5 });
  });

  it("should query db.call.count with the user's ID and today's UTC date range", async () => {
    mockDb.call.count.mockResolvedValue(3);

    const { callsV1Router } = await import("../calls");
    const handler: TodayCountHandler = (callsV1Router as any).todayCount.handler;

    await handler({
      ctx: { session: { user: { id: "user-456" } } },
      input: {},
    });

    expect(mockDb.call.count).toHaveBeenCalledWith({
      where: {
        userId: "user-456",
        createdAt: { gte: mockTodayStart, lte: mockTodayEnd },
      },
    });
  });

  it("should return 0 when no calls have been made today", async () => {
    mockDb.call.count.mockResolvedValue(0);

    const { callsV1Router } = await import("../calls");
    const handler: TodayCountHandler = (callsV1Router as any).todayCount.handler;

    const result = await handler({
      ctx: { session: { user: { id: "user-789" } } },
      input: {},
    });

    expect(result).toEqual({ count: 0 });
  });

  it("should use getUTCDayRange for the date boundaries", async () => {
    mockDb.call.count.mockResolvedValue(2);

    const { getUTCDayRange } = await import("../../../lib/date");
    const { callsV1Router } = await import("../calls");
    const handler: TodayCountHandler = (callsV1Router as any).todayCount.handler;

    await handler({
      ctx: { session: { user: { id: "user-101" } } },
      input: {},
    });

    expect(getUTCDayRange).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// start
// ---------------------------------------------------------------------------
describe("callsV1Router.start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return FORBIDDEN when phone number is blocked", async () => {
    mockDb.blockedNumber.findUnique.mockResolvedValue({
      id: "block-1",
      phoneNumber: "+33612345678",
    });

    const { callsV1Router } = await import("../calls");
    const handler: StartHandler = (callsV1Router as any).start.handler;

    await expect(
      handler({
        ctx: { session: { user: { id: "user-1" } } },
        input: { scenarioId: "scenario-1", phoneNumber: "+33612345678", maxDurationSeconds: 300 },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("should return TOO_MANY_REQUESTS when spam is detected", async () => {
    mockDb.blockedNumber.findUnique.mockResolvedValue(null);
    mockDetectCallSpam.mockResolvedValue({ flagged: true, reason: "Trop d'appels vers ce numéro" });

    const { callsV1Router } = await import("../calls");
    const handler: StartHandler = (callsV1Router as any).start.handler;

    await expect(
      handler({
        ctx: { session: { user: { id: "user-1" } } },
        input: { scenarioId: "scenario-1", phoneNumber: "+33612345678", maxDurationSeconds: 300 },
      }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("should initiate call, increment playCount, and invalidate cache on success", async () => {
    mockDb.blockedNumber.findUnique.mockResolvedValue(null);
    mockDetectCallSpam.mockResolvedValue({ flagged: false });
    mockRedis.keys.mockResolvedValue([]);

    const { callsV1Router } = await import("../calls");
    const { initiateCall } = await import("../../../services/telephony/callLifecycle");
    (initiateCall as Mock).mockResolvedValue({ callId: "call-1", estimatedCredits: 1 });

    const handler: StartHandler = (callsV1Router as any).start.handler;

    const result = await handler({
      ctx: { session: { user: { id: "user-1" } } },
      input: { scenarioId: "scenario-1", phoneNumber: "+33612345678", maxDurationSeconds: 300 },
    });

    expect(result).toEqual({ callId: "call-1", estimatedCredits: 1 });
    expect(mockDb.scenario.update).toHaveBeenCalledWith({
      where: { id: "scenario-1" },
      data: { playCount: { increment: 1 } },
    });
  });

  it("should delete cache keys when invalidating history cache", async () => {
    mockDb.blockedNumber.findUnique.mockResolvedValue(null);
    mockDetectCallSpam.mockResolvedValue({ flagged: false });
    mockRedis.keys.mockResolvedValue(["cache:calls:history:user-1:first:10"]);

    const { callsV1Router } = await import("../calls");
    const { initiateCall } = await import("../../../services/telephony/callLifecycle");
    (initiateCall as Mock).mockResolvedValue({ callId: "call-1", estimatedCredits: 1 });

    const handler: StartHandler = (callsV1Router as any).start.handler;

    await handler({
      ctx: { session: { user: { id: "user-1" } } },
      input: { scenarioId: "scenario-1", phoneNumber: "+33612345678", maxDurationSeconds: 300 },
    });

    expect(mockRedis.del).toHaveBeenCalledWith("cache:calls:history:user-1:first:10");
  });

  it("should map SCENARIO_NOT_FOUND AppError to NOT_FOUND", async () => {
    mockDb.blockedNumber.findUnique.mockResolvedValue(null);
    mockDetectCallSpam.mockResolvedValue({ flagged: false });

    const { callsV1Router } = await import("../calls");
    const { initiateCall } = await import("../../../services/telephony/callLifecycle");
    const { AppError } = await import("../../../lib/errors");
    (initiateCall as Mock).mockRejectedValue(
      new AppError("SCENARIO_NOT_FOUND", "Scénario introuvable"),
    );

    const handler: StartHandler = (callsV1Router as any).start.handler;

    await expect(
      handler({
        ctx: { session: { user: { id: "user-1" } } },
        input: { scenarioId: "nonexistent", phoneNumber: "+33612345678", maxDurationSeconds: 300 },
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("should map INSUFFICIENT_CREDITS AppError to PRECONDITION_FAILED", async () => {
    mockDb.blockedNumber.findUnique.mockResolvedValue(null);
    mockDetectCallSpam.mockResolvedValue({ flagged: false });

    const { callsV1Router } = await import("../calls");
    const { initiateCall } = await import("../../../services/telephony/callLifecycle");
    const { AppError } = await import("../../../lib/errors");
    (initiateCall as Mock).mockRejectedValue(
      new AppError("INSUFFICIENT_CREDITS", "Crédits insuffisants"),
    );

    const handler: StartHandler = (callsV1Router as any).start.handler;

    await expect(
      handler({
        ctx: { session: { user: { id: "user-1" } } },
        input: { scenarioId: "scenario-1", phoneNumber: "+33612345678", maxDurationSeconds: 300 },
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("should map TWILIO_ERROR AppError to INTERNAL_SERVER_ERROR", async () => {
    mockDb.blockedNumber.findUnique.mockResolvedValue(null);
    mockDetectCallSpam.mockResolvedValue({ flagged: false });

    const { callsV1Router } = await import("../calls");
    const { initiateCall } = await import("../../../services/telephony/callLifecycle");
    const { AppError } = await import("../../../lib/errors");
    (initiateCall as Mock).mockRejectedValue(new AppError("TWILIO_ERROR", "Échec de l'appel"));

    const handler: StartHandler = (callsV1Router as any).start.handler;

    await expect(
      handler({
        ctx: { session: { user: { id: "user-1" } } },
        input: { scenarioId: "scenario-1", phoneNumber: "+33612345678", maxDurationSeconds: 300 },
      }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  it("should map DAILY_LIMIT_EXCEEDED AppError to TOO_MANY_REQUESTS", async () => {
    mockDb.blockedNumber.findUnique.mockResolvedValue(null);
    mockDetectCallSpam.mockResolvedValue({ flagged: false });

    const { callsV1Router } = await import("../calls");
    const { initiateCall } = await import("../../../services/telephony/callLifecycle");
    const { AppError } = await import("../../../lib/errors");
    (initiateCall as Mock).mockRejectedValue(
      new AppError("DAILY_LIMIT_EXCEEDED", "Limite quotidienne"),
    );

    const handler: StartHandler = (callsV1Router as any).start.handler;

    await expect(
      handler({
        ctx: { session: { user: { id: "user-1" } } },
        input: { scenarioId: "scenario-1", phoneNumber: "+33612345678", maxDurationSeconds: 300 },
      }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("should re-throw non-AppError errors", async () => {
    mockDb.blockedNumber.findUnique.mockResolvedValue(null);
    mockDetectCallSpam.mockResolvedValue({ flagged: false });

    const { callsV1Router } = await import("../calls");
    const { initiateCall } = await import("../../../services/telephony/callLifecycle");
    (initiateCall as Mock).mockRejectedValue(new Error("Unexpected database error"));

    const handler: StartHandler = (callsV1Router as any).start.handler;

    await expect(
      handler({
        ctx: { session: { user: { id: "user-1" } } },
        input: { scenarioId: "scenario-1", phoneNumber: "+33612345678", maxDurationSeconds: 300 },
      }),
    ).rejects.toThrow("Unexpected database error");
  });

  it("should log warning when cache invalidation fails", async () => {
    mockDb.blockedNumber.findUnique.mockResolvedValue(null);
    mockDetectCallSpam.mockResolvedValue({ flagged: false });
    mockRedis.keys.mockRejectedValue(new Error("Redis connection lost"));

    const { callsV1Router } = await import("../calls");
    const { initiateCall } = await import("../../../services/telephony/callLifecycle");
    (initiateCall as Mock).mockResolvedValue({ callId: "call-1", estimatedCredits: 1 });

    const handler: StartHandler = (callsV1Router as any).start.handler;

    const result = await handler({
      ctx: { session: { user: { id: "user-1" } } },
      input: { scenarioId: "scenario-1", phoneNumber: "+33612345678", maxDurationSeconds: 300 },
    });

    expect(result).toEqual({ callId: "call-1", estimatedCredits: 1 });
  });

  it("should not fail when redis is null", async () => {
    const redisModule = await import("@/lib/redis");
    const origRedis = (redisModule as any).redis;
    (redisModule as any).redis = null;

    mockDb.blockedNumber.findUnique.mockResolvedValue(null);
    mockDetectCallSpam.mockResolvedValue({ flagged: false });

    const { callsV1Router } = await import("../calls");
    const { initiateCall } = await import("../../../services/telephony/callLifecycle");
    (initiateCall as Mock).mockResolvedValue({ callId: "call-1", estimatedCredits: 1 });

    const handler: StartHandler = (callsV1Router as any).start.handler;

    const result = await handler({
      ctx: { session: { user: { id: "user-1" } } },
      input: { scenarioId: "scenario-1", phoneNumber: "+33612345678", maxDurationSeconds: 300 },
    });

    expect(result).toEqual({ callId: "call-1", estimatedCredits: 1 });
    (redisModule as any).redis = origRedis;
  });

  it("should map USER_NOT_FOUND AppError to UNAUTHORIZED", async () => {
    mockDb.blockedNumber.findUnique.mockResolvedValue(null);
    mockDetectCallSpam.mockResolvedValue({ flagged: false });

    const { callsV1Router } = await import("../calls");
    const { initiateCall } = await import("../../../services/telephony/callLifecycle");
    const { AppError } = await import("../../../lib/errors");
    (initiateCall as Mock).mockRejectedValue(
      new AppError("USER_NOT_FOUND", "Utilisateur introuvable"),
    );

    const handler: StartHandler = (callsV1Router as any).start.handler;

    await expect(
      handler({
        ctx: { session: { user: { id: "user-1" } } },
        input: { scenarioId: "scenario-1", phoneNumber: "+33612345678", maxDurationSeconds: 300 },
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("should map unknown AppError to INTERNAL_SERVER_ERROR", async () => {
    mockDb.blockedNumber.findUnique.mockResolvedValue(null);
    mockDetectCallSpam.mockResolvedValue({ flagged: false });

    const { callsV1Router } = await import("../calls");
    const { initiateCall } = await import("../../../services/telephony/callLifecycle");
    const { AppError } = await import("../../../lib/errors");
    (initiateCall as Mock).mockRejectedValue(new (AppError as any)("UNKNOWN_ERROR", "Something went wrong"));

    const handler: StartHandler = (callsV1Router as any).start.handler;

    await expect(
      handler({
        ctx: { session: { user: { id: "user-1" } } },
        input: { scenarioId: "scenario-1", phoneNumber: "+33612345678", maxDurationSeconds: 300 },
      }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});

// ---------------------------------------------------------------------------
// history
// ---------------------------------------------------------------------------
describe("callsV1Router.history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return paginated call history with scenarios", async () => {
    const mockCalls = [
      {
        id: "call-3",
        userId: "user-1",
        createdAt: new Date("2026-06-03"),
        scenario: { id: "s-1", title: "Scenario 1", character: { name: "Bot", slug: "bot" } },
      },
      {
        id: "call-2",
        userId: "user-1",
        createdAt: new Date("2026-06-02"),
        scenario: { id: "s-2", title: "Scenario 2", character: { name: "Alice", slug: "alice" } },
      },
      {
        id: "call-1",
        userId: "user-1",
        createdAt: new Date("2026-06-01"),
        scenario: { id: "s-3", title: "Scenario 3", character: { name: "Bob", slug: "bob" } },
      },
    ];

    mockDb.call.findMany.mockResolvedValue(mockCalls);

    const { callsV1Router } = await import("../calls");
    const handler: HistoryHandler = (callsV1Router as any).history.handler;

    const result = await handler({
      ctx: { session: { user: { id: "user-1" } } },
      input: { limit: 10 },
    });

    expect(result.items).toHaveLength(3);
    expect(result.nextCursor).toBeUndefined();
    expect(mockDb.call.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      take: 11,
      orderBy: { createdAt: "desc" },
      include: {
        scenario: {
          select: { id: true, title: true, character: { select: { name: true, slug: true } } },
        },
      },
    });
  });

  it("should return cached result when available", async () => {
    const cachedResult = {
      items: [{ id: "call-1", scenario: { title: "Cached" } }],
      nextCursor: undefined,
    };
    mockRedis.get.mockResolvedValue(cachedResult);

    const { callsV1Router } = await import("../calls");
    const handler: HistoryHandler = (callsV1Router as any).history.handler;

    const result = await handler({
      ctx: { session: { user: { id: "user-1" } } },
      input: { limit: 10 },
    });

    expect(result).toEqual(cachedResult);
    expect(mockDb.call.findMany).not.toHaveBeenCalled();
  });

  it("should set cache with TTL 30 seconds on cache miss", async () => {
    mockRedis.get.mockResolvedValue(null);
    mockDb.call.findMany.mockResolvedValue([]);

    const { callsV1Router } = await import("../calls");
    const handler: HistoryHandler = (callsV1Router as any).history.handler;

    await handler({
      ctx: { session: { user: { id: "user-1" } } },
      input: { limit: 10 },
    });

    expect(mockRedis.set).toHaveBeenCalledWith(
      expect.stringContaining("cache:calls:history:user-1:"),
      expect.any(String),
      { ex: 30 },
    );
  });

  it("should handle cursor-based pagination", async () => {
    const mockCalls = [
      {
        id: "call-3",
        userId: "user-1",
        createdAt: new Date("2026-06-03"),
        scenario: { title: "S3", character: { name: "C", slug: "c" } },
      },
      {
        id: "call-2",
        userId: "user-1",
        createdAt: new Date("2026-06-02"),
        scenario: { title: "S2", character: { name: "B", slug: "b" } },
      },
      {
        id: "call-1",
        userId: "user-1",
        createdAt: new Date("2026-06-01"),
        scenario: { title: "S1", character: { name: "A", slug: "a" } },
      },
    ];
    mockRedis.get.mockResolvedValue(null);
    mockDb.call.findMany.mockResolvedValue(mockCalls);

    const { callsV1Router } = await import("../calls");
    const handler: HistoryHandler = (callsV1Router as any).history.handler;

    const result = await handler({
      ctx: { session: { user: { id: "user-1" } } },
      input: { cursor: "call-4", limit: 3 },
    });

    expect(result.items).toHaveLength(3);
    expect(mockDb.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 1, cursor: { id: "call-4" } }),
    );
  });

  it("should return nextCursor when there are more results than limit", async () => {
    const mockCalls = Array.from({ length: 11 }, (_, i) => ({
      id: `call-${i}`,
      userId: "user-1",
      createdAt: new Date(`2026-06-${String(i + 1).padStart(2, "0")}`),
      scenario: { title: `S${i}`, character: { name: `C${i}`, slug: `c${i}` } },
    }));
    mockRedis.get.mockResolvedValue(null);
    mockDb.call.findMany.mockResolvedValue(mockCalls);

    const { callsV1Router } = await import("../calls");
    const handler: HistoryHandler = (callsV1Router as any).history.handler;

    const result = await handler({
      ctx: { session: { user: { id: "user-1" } } },
      input: { limit: 10 },
    });

    expect(result.items).toHaveLength(10);
    expect(result.nextCursor).toBeDefined();
  });

  it("should return empty items list when no calls exist", async () => {
    mockRedis.get.mockResolvedValue(null);
    mockDb.call.findMany.mockResolvedValue([]);

    const { callsV1Router } = await import("../calls");
    const handler: HistoryHandler = (callsV1Router as any).history.handler;

    const result = await handler({
      ctx: { session: { user: { id: "user-empty" } } },
      input: { limit: 10 },
    });

    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeUndefined();
  });

  it("should use correct cache key format", async () => {
    mockRedis.get.mockResolvedValue(null);
    mockDb.call.findMany.mockResolvedValue([]);

    const { callsV1Router } = await import("../calls");
    const handler: HistoryHandler = (callsV1Router as any).history.handler;

    await handler({
      ctx: { session: { user: { id: "user-cache" } } },
      input: { cursor: "abc-123", limit: 5 },
    });

    expect(mockRedis.get).toHaveBeenCalledWith("cache:calls:history:user-cache:abc-123:5");
  });

  it("should log warning when cache read fails and continue to DB", async () => {
    mockRedis.get.mockRejectedValue(new Error("Redis read error"));
    mockDb.call.findMany.mockResolvedValue([]);

    const { callsV1Router } = await import("../calls");
    const handler: HistoryHandler = (callsV1Router as any).history.handler;

    const result = await handler({
      ctx: { session: { user: { id: "user-1" } } },
      input: { limit: 10 },
    });

    expect(result.items).toEqual([]);
    expect(mockDb.call.findMany).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// listByScenario
// ---------------------------------------------------------------------------
describe("callsV1Router.listByScenario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return calls filtered by scenarioId with non-null recordingUrl", async () => {
    const mockCalls = [
      {
        id: "call-1",
        durationSeconds: 120,
        createdAt: new Date("2026-06-01"),
        status: "COMPLETED",
      },
    ];
    mockDb.call.findMany.mockResolvedValue(mockCalls);

    const { callsV1Router } = await import("../calls");
    const handler: ListByScenarioHandler = (callsV1Router as any).listByScenario.handler;

    const result = await handler({
      ctx: { session: { user: { id: "user-1" } } },
      input: { scenarioId: "scenario-1", limit: 10 },
    });

    expect(result.items).toEqual(mockCalls);
    expect(mockDb.call.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        scenarioId: "scenario-1",
        recordingUrl: { not: null },
      },
      take: 11,
      orderBy: { createdAt: "desc" },
      select: { id: true, durationSeconds: true, createdAt: true, status: true },
    });
  });

  it("should support cursor pagination", async () => {
    mockDb.call.findMany.mockResolvedValue([]);

    const { callsV1Router } = await import("../calls");
    const handler: ListByScenarioHandler = (callsV1Router as any).listByScenario.handler;

    await handler({
      ctx: { session: { user: { id: "user-1" } } },
      input: { scenarioId: "scenario-1", cursor: "call-5", limit: 5 },
    });

    expect(mockDb.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 1, cursor: { id: "call-5" }, take: 6 }),
    );
  });

  it("should return empty list when no calls exist", async () => {
    mockDb.call.findMany.mockResolvedValue([]);

    const { callsV1Router } = await import("../calls");
    const handler: ListByScenarioHandler = (callsV1Router as any).listByScenario.handler;

    const result = await handler({
      ctx: { session: { user: { id: "user-1" } } },
      input: { scenarioId: "nonexistent", limit: 10 },
    });

    expect(result.items).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// replay
// ---------------------------------------------------------------------------
describe("callsV1Router.replay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return recordingUrl and transcript for an owned call", async () => {
    mockGetPresignedUrl.mockResolvedValue("https://presigned.example.com/audio.wav");

    mockDb.call.findUnique.mockResolvedValue({
      id: "call-1",
      userId: "user-1",
      recordingUrl: "https://r2.example.com/audio/call-1.wav",
      transcript: [{ speaker: "AI", text: "Hello", timestamp: 1000 }],
    });

    const { callsV1Router } = await import("../calls");
    const handler: ReplayHandler = (callsV1Router as any).replay.handler;

    const result = await handler({
      ctx: { session: { user: { id: "user-1" } } },
      input: { callId: "call-1" },
    });

    expect(result.recordingUrl).toBe("https://presigned.example.com/audio.wav");
    expect(result.transcript).toEqual([{ speaker: "AI", text: "Hello", timestamp: 1000 }]);
  });

  it("should throw FORBIDDEN when call is not owned by user", async () => {
    mockDb.call.findUnique.mockResolvedValue({
      id: "call-1",
      userId: "other-user",
      recordingUrl: null,
      transcript: null,
    });

    const { callsV1Router } = await import("../calls");
    const handler: ReplayHandler = (callsV1Router as any).replay.handler;

    await expect(
      handler({
        ctx: { session: { user: { id: "user-1" } } },
        input: { callId: "call-1" },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: "Cet appel ne vous appartient pas" });
  });

  it("should throw NOT_FOUND when call does not exist", async () => {
    mockDb.call.findUnique.mockResolvedValue(null);

    const { callsV1Router } = await import("../calls");
    const handler: ReplayHandler = (callsV1Router as any).replay.handler;

    await expect(
      handler({
        ctx: { session: { user: { id: "user-1" } } },
        input: { callId: "nonexistent" },
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Appel introuvable" });
  });

  it("should return null recordingUrl when call has no recording", async () => {
    mockDb.call.findUnique.mockResolvedValue({
      id: "call-1",
      userId: "user-1",
      recordingUrl: null,
      transcript: [{ speaker: "AI", text: "Hello", timestamp: 1000 }],
    });

    const { callsV1Router } = await import("../calls");
    const handler: ReplayHandler = (callsV1Router as any).replay.handler;

    const result = await handler({
      ctx: { session: { user: { id: "user-1" } } },
      input: { callId: "call-1" },
    });

    expect(result.recordingUrl).toBeNull();
  });

  it("should return null transcript when call has no transcript", async () => {
    mockGetPresignedUrl.mockResolvedValue("https://presigned.example.com/audio.wav");

    mockDb.call.findUnique.mockResolvedValue({
      id: "call-1",
      userId: "user-1",
      recordingUrl: "https://r2.example.com/audio.wav",
      transcript: null,
    });

    const { callsV1Router } = await import("../calls");
    const handler: ReplayHandler = (callsV1Router as any).replay.handler;

    const result = await handler({
      ctx: { session: { user: { id: "user-1" } } },
      input: { callId: "call-1" },
    });

    expect(result.transcript).toBeNull();
  });

  it("should return null presignedUrl when getPresignedUrl fails", async () => {
    mockGetPresignedUrl.mockResolvedValue(null);

    mockDb.call.findUnique.mockResolvedValue({
      id: "call-1",
      userId: "user-1",
      recordingUrl: "https://r2.example.com/audio.wav",
      transcript: null,
    });

    const { callsV1Router } = await import("../calls");
    const handler: ReplayHandler = (callsV1Router as any).replay.handler;

    const result = await handler({
      ctx: { session: { user: { id: "user-1" } } },
      input: { callId: "call-1" },
    });

    expect(result.recordingUrl).toBeNull();
  });
});
