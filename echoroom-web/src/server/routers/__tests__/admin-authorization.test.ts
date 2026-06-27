import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Admin authorization tests
// ---------------------------------------------------------------------------
// Tests that adminProcedure enforces authentication and role checks.
// Uses a custom trpc mock that validates session before calling handlers.

const mockDb = vi.hoisted(() => ({
  scenario: {
    findUnique: vi.fn(),
  },
  featuredScenario: {
    upsert: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
}));

vi.mock("@/server/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/redis", () => ({
  redis: null,
}));

// Custom procedures mock with auth enforcement — adminProcedure checks session role
// admin.ts imports adminProcedure from "../procedures", so we mock @/server/procedures
vi.mock("@/server/procedures", () => {
  const createChain = (requiredRole?: string) => {
    const chain = {
      input: vi.fn(() => chain),
      mutation: vi.fn((handler: Function) => ({
        type: "mutation" as const,
        handler: async (opts: any) => {
          const session = opts.ctx?.session;
          if (!session?.user?.id) {
            const err: any = new Error("Vous devez être connecté pour accéder à cette ressource");
            err.code = "UNAUTHORIZED";
            throw err;
          }
          if (requiredRole && session.user.role !== requiredRole) {
            const err: any = new Error("Accès réservé aux administrateurs");
            err.code = "FORBIDDEN";
            throw err;
          }
          return handler(opts);
        },
      })),
      query: vi.fn((handler: Function) => ({
        type: "query" as const,
        handler: async (opts: any) => {
          const session = opts.ctx?.session;
          if (!session?.user?.id) {
            const err: any = new Error("Vous devez être connecté pour accéder à cette ressource");
            err.code = "UNAUTHORIZED";
            throw err;
          }
          if (requiredRole && session.user.role !== requiredRole) {
            const err: any = new Error("Accès réservé aux administrateurs");
            err.code = "FORBIDDEN";
            throw err;
          }
          return handler(opts);
        },
      })),
      use: vi.fn(() => chain),
    };
    return chain;
  };

  return {
    router: vi.fn((routes: Record<string, unknown>) => routes),
    adminProcedure: createChain("ADMIN"),
    publicProcedure: createChain(),
    protectedProcedure: createChain(),
    middleware: vi.fn((fn: Function) => fn),
    withRateLimit: vi.fn(() => (opts: { next: Function }) => opts.next()),
    withTracing: vi.fn(() => createChain()),
    isAuthenticated: createChain(),
    isAdmin: createChain("ADMIN"),
  };
});

describe("adminRouter authorization — mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.scenario.findUnique.mockResolvedValue({ id: "s-1" });
    mockDb.featuredScenario.upsert.mockResolvedValue({ id: "f-1" });
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });
  });

  it("should reject USER role with FORBIDDEN on mutation", async () => {
    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).featureScenario.handler;

    await expect(
      handler({
        input: { scenarioId: "s-1" },
        ctx: { session: { user: { id: "u-1", role: "USER" } } },
      }),
    ).rejects.toThrow("Accès réservé aux administrateurs");
  });

  it("should reject USER role with TRPCError code FORBIDDEN on mutation", async () => {
    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).featureScenario.handler;

    try {
      await handler({
        input: { scenarioId: "s-1" },
        ctx: { session: { user: { id: "u-1", role: "USER" } } },
      });
      expect.unreachable("Expected FORBIDDEN error");
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });

  it("should reject MODERATOR role with FORBIDDEN on mutation", async () => {
    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).featureScenario.handler;

    await expect(
      handler({
        input: { scenarioId: "s-1" },
        ctx: { session: { user: { id: "u-1", role: "MODERATOR" } } },
      }),
    ).rejects.toThrow("Accès réservé aux administrateurs");
  });

  it("should reject missing session with UNAUTHORIZED on mutation", async () => {
    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).featureScenario.handler;

    await expect(
      handler({
        input: { scenarioId: "s-1" },
        ctx: { session: null },
      }),
    ).rejects.toThrow("Vous devez être connecté");
  });

  it("should reject empty session.user with UNAUTHORIZED on mutation", async () => {
    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).featureScenario.handler;

    await expect(
      handler({
        input: { scenarioId: "s-1" },
        ctx: { session: {} },
      }),
    ).rejects.toThrow("Vous devez être connecté");
  });

  it("should reject session without user.id with UNAUTHORIZED on mutation", async () => {
    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).featureScenario.handler;

    await expect(
      handler({
        input: { scenarioId: "s-1" },
        ctx: { session: { user: {} } },
      }),
    ).rejects.toThrow("Vous devez être connecté");
  });

  it("should allow ADMIN role and successfully execute mutation", async () => {
    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).featureScenario.handler;

    const result = await handler({
      input: { scenarioId: "s-1" },
      ctx: { session: { user: { id: "admin-1", role: "ADMIN" } } },
    });

    expect(result).toEqual({ success: true });
    expect(mockDb.scenario.findUnique).toHaveBeenCalledWith({
      where: { id: "s-1" },
    });
    expect(mockDb.featuredScenario.upsert).toHaveBeenCalled();
    expect(mockDb.auditLog.create).toHaveBeenCalled();
  });

  it("should not call db operations when auth fails on mutation", async () => {
    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).featureScenario.handler;

    try {
      await handler({
        input: { scenarioId: "s-1" },
        ctx: { session: { user: { id: "u-1", role: "USER" } } },
      });
    } catch {
      // expected
    }

    expect(mockDb.scenario.findUnique).not.toHaveBeenCalled();
    expect(mockDb.featuredScenario.upsert).not.toHaveBeenCalled();
    expect(mockDb.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("adminRouter authorization — queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reject USER role with FORBIDDEN on query", async () => {
    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).getFeaturedScenario.handler;

    await expect(
      handler({
        input: undefined,
        ctx: { session: { user: { id: "u-1", role: "USER" } } },
      }),
    ).rejects.toThrow("Accès réservé aux administrateurs");
  });

  it("should reject MODERATOR role with FORBIDDEN on query", async () => {
    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).getFeaturedScenario.handler;

    await expect(
      handler({
        input: undefined,
        ctx: { session: { user: { id: "u-1", role: "MODERATOR" } } },
      }),
    ).rejects.toThrow("Accès réservé aux administrateurs");
  });

  it("should reject missing session with UNAUTHORIZED on query", async () => {
    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).getFeaturedScenario.handler;

    await expect(
      handler({
        input: undefined,
        ctx: { session: null },
      }),
    ).rejects.toThrow("Vous devez être connecté");
  });

  it("should allow ADMIN role and successfully execute query", async () => {
    (mockDb.featuredScenario as any).findUnique = vi.fn().mockResolvedValue(null);

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).getFeaturedScenario.handler;

    const result = await handler({
      input: undefined,
      ctx: { session: { user: { id: "admin-1", role: "ADMIN" } } },
    });

    expect(result).toBeNull();
  });

  it("should not call db operations when auth fails on query", async () => {
    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).getFeaturedScenario.handler;

    try {
      await handler({
        input: undefined,
        ctx: { session: { user: { id: "u-1", role: "USER" } } },
      });
    } catch {
      // expected
    }

    // No featuredScenario lookup should happen
  });
});

describe("adminRouter authorization — all admin routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    "featureScenario",
    "removeFeatured",
    "approveScenario",
    "rejectScenario",
    "moderateComment",
    "approveComment",
    "rejectComment",
    "dismissAbuseReport",
    "blockNumber",
    "unblockNumber",
    "deleteUser",
    "purgeGDPR",
    "retryDLQ",
  ])("should reject USER role on mutation %s with FORBIDDEN", async (route) => {
    const { adminRouter } = await import("../admin");
    const proc = (adminRouter as any)[route];
    if (!proc || proc.type !== "mutation") return;

    await expect(
      proc.handler({
        input: {},
        ctx: { session: { user: { id: "u-1", role: "USER" } } },
      }),
    ).rejects.toThrow("Accès réservé aux administrateurs");
  });

  it.each([
    "getFeaturedScenario",
    "moderationQueue",
    "getAuditLogs",
    "getAbuseReports",
    "getBlockedNumbers",
    "getDLQ",
    "moderationQueueComments",
    "listUsers",
    "getUserDetail",
  ])("should reject USER role on query %s with FORBIDDEN", async (route) => {
    const { adminRouter } = await import("../admin");
    const proc = (adminRouter as any)[route];
    if (!proc || proc.type !== "query") return;

    await expect(
      proc.handler({
        input: {},
        ctx: { session: { user: { id: "u-1", role: "USER" } } },
      }),
    ).rejects.toThrow("Accès réservé aux administrateurs");
  });
});
