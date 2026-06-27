import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Admin audit logs tests
// ---------------------------------------------------------------------------

const mockDb = vi.hoisted(() => ({
  auditLog: {
    findMany: vi.fn(),
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

describe("adminRouter.getAuditLogs", () => {
  const makeLog = (id: string, action: string, overrides = {}) => ({
    id,
    action,
    entityType: "Scenario",
    entityId: "entity-1",
    adminId: "admin-1",
    createdAt: new Date("2026-06-20T12:00:00Z"),
    admin: { id: "admin-1", username: "admin" },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.get.mockReset();
    mockRedis.set.mockReset();
  });

  it("should return audit logs with pagination", async () => {
    const logs = [makeLog("log-1", "APPROVE_SCENARIO"), makeLog("log-2", "REJECT_SCENARIO")];
    mockDb.auditLog.findMany.mockResolvedValue(logs);
    mockRedis.get.mockResolvedValue(null);

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).getAuditLogs.handler;

    const result = await handler({
      input: { limit: 20 },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe("log-1");
    expect(result.nextCursor).toBeUndefined();
    expect(mockDb.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
        take: 21,
        include: {
          admin: { select: { id: true, username: true } },
        },
      }),
    );
  });

  it("should filter by action type", async () => {
    const logs = [makeLog("log-1", "APPROVE_SCENARIO")];
    mockDb.auditLog.findMany.mockResolvedValue(logs);
    mockRedis.get.mockResolvedValue(null);

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).getAuditLogs.handler;

    const result = await handler({
      input: { action: "APPROVE_SCENARIO", limit: 20 },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(result.items).toHaveLength(1);
    expect(mockDb.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          action: { equals: "APPROVE_SCENARIO" },
        }),
      }),
    );
  });

  it("should filter by date range", async () => {
    mockDb.auditLog.findMany.mockResolvedValue([]);
    mockRedis.get.mockResolvedValue(null);

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).getAuditLogs.handler;

    await handler({
      input: {
        startDate: "2026-06-01T00:00:00Z",
        endDate: "2026-06-30T23:59:59Z",
        limit: 20,
      },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(mockDb.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: new Date("2026-06-01T00:00:00Z"),
            lte: new Date("2026-06-30T23:59:59Z"),
          },
        }),
      }),
    );
  });

  it("should return empty array when startDate is after endDate", async () => {
    mockDb.auditLog.findMany.mockResolvedValue([]);
    mockRedis.get.mockResolvedValue(null);

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).getAuditLogs.handler;

    const result = await handler({
      input: {
        startDate: "2026-07-01T00:00:00Z",
        endDate: "2026-06-01T00:00:00Z",
        limit: 20,
      },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    // No results because the range is inverted
    expect(result.items).toEqual([]);
  });

  it("should return empty array for future date", async () => {
    mockDb.auditLog.findMany.mockResolvedValue([]);
    mockRedis.get.mockResolvedValue(null);

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).getAuditLogs.handler;

    const result = await handler({
      input: {
        startDate: "2099-01-01T00:00:00Z",
        limit: 20,
      },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(result.items).toEqual([]);
  });

  it("should filter by adminId", async () => {
    mockDb.auditLog.findMany.mockResolvedValue([]);
    mockRedis.get.mockResolvedValue(null);

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).getAuditLogs.handler;

    await handler({
      input: { adminId: "admin-42", limit: 20 },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(mockDb.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          adminId: "admin-42",
        }),
      }),
    );
  });

  it("should set nextCursor when there are more results", async () => {
    const logs = Array.from({ length: 21 }, (_, i) =>
      makeLog(`log-${i + 1}`, "APPROVE_SCENARIO", {
        createdAt: new Date(2026, 5, 20, 12, i),
      }),
    );
    mockDb.auditLog.findMany.mockResolvedValue(logs);
    mockRedis.get.mockResolvedValue(null);

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).getAuditLogs.handler;

    const result = await handler({
      input: { limit: 20 },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(result.items).toHaveLength(20);
    expect(result.nextCursor).toBe("log-20");
  });

  it("should return cached result when cache is hit", async () => {
    const cached = {
      items: [makeLog("log-cached", "APPROVE_SCENARIO")],
      nextCursor: undefined,
    };
    mockRedis.get.mockResolvedValue(JSON.stringify(cached));

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).getAuditLogs.handler;

    const result = await handler({
      input: { limit: 20 },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("log-cached");
    expect(mockDb.auditLog.findMany).not.toHaveBeenCalled();
  });

  it("should set cache on miss with ex=60", async () => {
    mockRedis.get.mockResolvedValue(null);
    mockDb.auditLog.findMany.mockResolvedValue([]);

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).getAuditLogs.handler;

    await handler({
      input: { limit: 20 },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(mockRedis.set).toHaveBeenCalledWith(
      expect.stringContaining("admin:auditLogs"),
      expect.any(String),
      { ex: 60 },
    );
  });

  it("should include admin info in results", async () => {
    const logs = [
      makeLog("log-1", "APPROVE_SCENARIO", {
        admin: { id: "admin-1", username: "superadmin" },
      }),
    ];
    mockDb.auditLog.findMany.mockResolvedValue(logs);
    mockRedis.get.mockResolvedValue(null);

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).getAuditLogs.handler;

    const result = await handler({
      input: { limit: 20 },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(result.items[0].admin.username).toBe("superadmin");
  });

  it("should use cursor-based pagination", async () => {
    const logs = [makeLog("log-11", "APPROVE_SCENARIO")];
    mockDb.auditLog.findMany.mockResolvedValue(logs);
    mockRedis.get.mockResolvedValue(null);

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).getAuditLogs.handler;

    await handler({
      input: { cursor: "log-10", limit: 10 },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(mockDb.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 1,
        cursor: { id: "log-10" },
      }),
    );
  });
});
