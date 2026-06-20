import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Admin abuse report tests
// ---------------------------------------------------------------------------

const mockDb = vi.hoisted(() => ({
  abuseReport: {
    findUnique: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
}));

vi.mock("@/server/db", () => ({
  db: mockDb,
}));

const mockRedis = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  redis: mockRedis,
}));

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
    adminProcedure: chain,
    publicProcedure: chain,
    protectedProcedure: chain,
    middleware: vi.fn((fn: Function) => fn),
    withRateLimit: vi.fn(() => (opts: { next: Function }) => opts.next()),
    withTracing: vi.fn(() => chain),
    isAuthenticated: chain,
    isAdmin: chain,
  };
});

// ─── dismissAbuseReport ────────────────────────────────────────────────────

describe("adminRouter.dismissAbuseReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.abuseReport.findUnique.mockResolvedValue({
      id: "report-1",
      status: "PENDING",
    });
    mockDb.abuseReport.update.mockResolvedValue({
      id: "report-1",
      status: "DISMISSED",
    });
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });
    mockRedis.del.mockResolvedValue(1);
  });

  it("should dismiss a PENDING report", async () => {
    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).dismissAbuseReport.handler;

    const result = await handler({
      input: { reportId: "report-1" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(result).toEqual({ success: true });
    expect(mockDb.abuseReport.update).toHaveBeenCalledWith({
      where: { id: "report-1" },
      data: {
        status: "DISMISSED",
        reviewedById: "admin-1",
        reviewedAt: expect.any(Date),
      },
    });
    expect(mockDb.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: "DISMISS_ABUSE_REPORT",
        entityType: "AbuseReport",
        entityId: "report-1",
        adminId: "admin-1",
      },
    });
  });

  it("should throw NOT_FOUND when report does not exist", async () => {
    mockDb.abuseReport.findUnique.mockResolvedValue(null);

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).dismissAbuseReport.handler;

    await expect(
      handler({
        input: { reportId: "nonexistent" },
        ctx: { session: { user: { id: "admin-1" } } },
      }),
    ).rejects.toThrow("Signalement introuvable");

    expect(mockDb.abuseReport.update).not.toHaveBeenCalled();
    expect(mockDb.auditLog.create).not.toHaveBeenCalled();
  });

  it("should be idempotent when report is already DISMISSED", async () => {
    mockDb.abuseReport.findUnique.mockResolvedValue({
      id: "report-1",
      status: "DISMISSED",
    });

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).dismissAbuseReport.handler;

    const result = await handler({
      input: { reportId: "report-1" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(result).toEqual({ success: true });
    expect(mockDb.abuseReport.update).toHaveBeenCalled();
    expect(mockDb.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it("should invalidate abuse report cache with pattern", async () => {
    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).dismissAbuseReport.handler;

    await handler({
      input: { reportId: "report-1" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(mockRedis.del).toHaveBeenCalledWith("admin:abuseReports:*");
  });
});

// ─── getAbuseReports ───────────────────────────────────────────────────────

describe("adminRouter.getAbuseReports", () => {
  const makeReport = (id: string, status: string) => ({
    id,
    status,
    createdAt: new Date(),
    reporter: { id: "reporter-1", username: "reporter" },
    reviewedBy: null,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.get.mockReset();
    mockRedis.set.mockReset();
  });

  it("should return all reports without status filter", async () => {
    const reports = [makeReport("r-1", "PENDING"), makeReport("r-2", "DISMISSED")];
    mockDb.abuseReport.findMany.mockResolvedValue(reports);
    mockRedis.get.mockResolvedValue(null); // cache miss

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).getAbuseReports.handler;

    const result = await handler({
      input: { limit: 20 },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(result.items).toHaveLength(2);
    expect(mockDb.abuseReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("should filter by status when provided", async () => {
    const reports = [makeReport("r-1", "PENDING")];
    mockDb.abuseReport.findMany.mockResolvedValue(reports);
    mockRedis.get.mockResolvedValue(null);

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).getAbuseReports.handler;

    const result = await handler({
      input: { status: "PENDING", limit: 20 },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(result.items).toHaveLength(1);
    expect(mockDb.abuseReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { equals: "PENDING" } },
      }),
    );
  });

  it("should return empty array when no reports match filter", async () => {
    mockDb.abuseReport.findMany.mockResolvedValue([]);
    mockRedis.get.mockResolvedValue(null);

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).getAbuseReports.handler;

    const result = await handler({
      input: { status: "RESOLVED", limit: 20 },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeUndefined();
  });

  it("should use cached result when available", async () => {
    const cached = {
      items: [makeReport("r-cached", "PENDING")],
      nextCursor: undefined,
    };
    mockRedis.get.mockResolvedValue(JSON.stringify(cached));

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).getAbuseReports.handler;

    const result = await handler({
      input: { limit: 20 },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("r-cached");
    expect(mockDb.abuseReport.findMany).not.toHaveBeenCalled();
  });

  it("should set cache on miss with ex=30", async () => {
    mockRedis.get.mockResolvedValue(null);
    mockDb.abuseReport.findMany.mockResolvedValue([]);

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).getAbuseReports.handler;

    await handler({
      input: { limit: 20 },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(mockRedis.set).toHaveBeenCalledWith(
      expect.stringContaining("admin:abuseReports"),
      expect.any(String),
      { ex: 30 },
    );
  });

  it("should invalidate cache after dismiss", async () => {
    mockDb.abuseReport.findUnique.mockResolvedValue({
      id: "report-1",
      status: "PENDING",
    });
    mockDb.abuseReport.update.mockResolvedValue({
      id: "report-1",
      status: "DISMISSED",
    });
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });

    const { adminRouter } = await import("../admin");
    const dismissHandler = (adminRouter as any).dismissAbuseReport.handler;

    await dismissHandler({
      input: { reportId: "report-1" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(mockRedis.del).toHaveBeenCalledWith("admin:abuseReports:*");
  });
});
