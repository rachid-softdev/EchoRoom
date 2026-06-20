import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TRPCError } from "@trpc/server";

// ---------------------------------------------------------------------------
// adminV1Router tests
// ---------------------------------------------------------------------------
// Tests the v1 admin router by mocking @/server/procedures and @/server/db.
// The mocked procedures capture mutation/query handlers so we can call them
// directly with controlled inputs and context.

const mockDb = vi.hoisted(() => ({
  scenario: {
    findUnique: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  featuredScenario: {
    upsert: vi.fn(),
    deleteMany: vi.fn(),
    findUnique: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  comment: {
    findUnique: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  blockedNumber: {
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
  },
  abuseReport: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  db: mockDb,
}));

// Mock Redis to avoid real connection attempts
vi.mock("@/lib/redis", () => ({
  redis: null,
}));

// Mock bcryptjs for password hashing
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2b$12$mocked_bcrypt_hash"),
    compare: vi.fn(),
  },
}));

vi.mock("@/server/services/user/anonymization", () => ({
  anonymizePersonalData: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/jobs/gdprPurge", () => ({
  purgeAnonymizedUsers: vi.fn(),
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock procedures with auth enforcement — adminProcedure checks session role
vi.mock("@/server/procedures", () => {
  const createChain = (requiredRole?: string) => {
    const chain = {
      input: vi.fn(() => chain),
      mutation: vi.fn((handler: Function) => ({
        type: "mutation" as const,
        handler: async (opts: any) => {
          const session = opts.ctx?.session;
          if (!session?.user?.id) {
            const err: any = new Error(
              "Vous devez être connecté pour accéder à cette ressource",
            );
            err.code = "UNAUTHORIZED";
            throw err;
          }
          if (requiredRole && session.user.role !== requiredRole) {
            const err: any = new Error(
              "Accès réservé aux administrateurs",
            );
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
            const err: any = new Error(
              "Vous devez être connecté pour accéder à cette ressource",
            );
            err.code = "UNAUTHORIZED";
            throw err;
          }
          if (requiredRole && session.user.role !== requiredRole) {
            const err: any = new Error(
              "Accès réservé aux administrateurs",
            );
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
    withIPRateLimit: vi.fn(() => (opts: { next: Function }) => opts.next()),
    withContentModeration: vi.fn(() => (opts: { next: Function }) => opts.next()),
    withTracing: vi.fn(() => createChain()),
    isAuthenticated: createChain(),
    isAdmin: createChain("ADMIN"),
  };
});

vi.mock("@/server/middleware/metrics", () => ({
  withREDMetrics: vi.fn(() => (opts: { next: Function }) => opts.next()),
}));

// Also mock @/server/trpc since v1 admin.ts imports from there directly
vi.mock("@/server/trpc", () => {
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
        if (session.user.role !== "ADMIN") {
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
        if (session.user.role !== "ADMIN") {
          const err: any = new Error("Accès réservé aux administrateurs");
          err.code = "FORBIDDEN";
          throw err;
        }
        return handler(opts);
      },
    })),
    use: vi.fn(() => chain),
  };

  return {
    t: { procedure: chain },
    router: vi.fn((routes: Record<string, unknown>) => routes),
    mergeRouters: vi.fn(),
    publicProcedure: chain,
    protectedProcedure: chain,
    adminProcedure: chain,
    middleware: vi.fn((fn: Function) => fn),
    withRateLimit: vi.fn(() => (opts: { next: Function }) => opts.next()),
    withTracing: vi.fn(() => chain),
    isAuthenticated: chain,
    isAdmin: chain,
    withContentModeration: vi.fn(() => (opts: { next: Function }) => opts.next()),
    withIPRateLimit: vi.fn(() => (opts: { next: Function }) => opts.next()),
    extractTextFromInput: vi.fn(),
  };
});

type MutationHandler = (opts: { input: any; ctx: any }) => Promise<{ success: boolean }>;
type QueryHandler = (opts: { input?: any; ctx?: any }) => Promise<any>;

const adminCtx = { session: { user: { id: "admin-1", role: "ADMIN" } } };
const userCtx = { session: { user: { id: "user-1", role: "USER" } } };

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------
describe("adminV1Router — authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reject USER role with FORBIDDEN on mutation", async () => {
    mockDb.scenario.findUnique.mockResolvedValue({ id: "s-1" });
    mockDb.featuredScenario.upsert.mockResolvedValue({ id: "f-1" });
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });

    const { adminV1Router } = await import("../admin");
    const handler = (adminV1Router as any).featureScenario.handler;

    await expect(
      handler({
        input: { scenarioId: "s-1" },
        ctx: userCtx,
      }),
    ).rejects.toThrow("Accès réservé aux administrateurs");
  });

  it("should reject unauthenticated with UNAUTHORIZED on mutation", async () => {
    const { adminV1Router } = await import("../admin");
    const handler = (adminV1Router as any).featureScenario.handler;

    await expect(
      handler({
        input: { scenarioId: "s-1" },
        ctx: { session: null },
      }),
    ).rejects.toThrow("Vous devez être connecté");
  });
});

// ---------------------------------------------------------------------------
// featureScenario
// ---------------------------------------------------------------------------
describe("adminV1Router.featureScenario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should upsert a featuredScenario with today's date when scenario exists", async () => {
    mockDb.scenario.findUnique.mockResolvedValue({ id: "scenario-abc" });
    mockDb.featuredScenario.upsert.mockResolvedValue({ id: "featured-1" });
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });

    const { adminV1Router } = await import("../admin");
    const handler: MutationHandler = (adminV1Router as any).featureScenario.handler;

    const result = await handler({
      input: { scenarioId: "scenario-abc" },
      ctx: adminCtx,
    });

    expect(result).toEqual({ success: true });
    expect(mockDb.scenario.findUnique).toHaveBeenCalledWith({
      where: { id: "scenario-abc" },
    });
    expect(mockDb.featuredScenario.upsert).toHaveBeenCalledTimes(1);
    const upsertCall = mockDb.featuredScenario.upsert.mock.calls[0]![0];
    expect(upsertCall.where).toHaveProperty("featuredDate");
    expect(upsertCall.where.featuredDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(upsertCall.update).toHaveProperty("featureType", "ADMIN_CURATED");
    expect(upsertCall.create).toHaveProperty("featureType", "ADMIN_CURATED");
  });

  it("should throw NOT_FOUND when scenario does not exist", async () => {
    mockDb.scenario.findUnique.mockResolvedValue(null);

    const { adminV1Router } = await import("../admin");
    const handler: MutationHandler = (adminV1Router as any).featureScenario.handler;

    await expect(
      handler({ input: { scenarioId: "nonexistent" }, ctx: adminCtx }),
    ).rejects.toThrow("Scénario introuvable");

    expect(mockDb.featuredScenario.upsert).not.toHaveBeenCalled();
    expect(mockDb.auditLog.create).not.toHaveBeenCalled();
  });

  it("should create audit log with correct action", async () => {
    mockDb.scenario.findUnique.mockResolvedValue({ id: "scenario-abc" });
    mockDb.featuredScenario.upsert.mockResolvedValue({ id: "featured-1" });
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });

    const { adminV1Router } = await import("../admin");
    const handler: MutationHandler = (adminV1Router as any).featureScenario.handler;

    await handler({ input: { scenarioId: "scenario-abc" }, ctx: adminCtx });

    expect(mockDb.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: "FEATURE_SCENARIO",
        entityType: "Scenario",
        entityId: "scenario-abc",
        adminId: "admin-1",
      },
    });
  });
});

// ---------------------------------------------------------------------------
// removeFeatured
// ---------------------------------------------------------------------------
describe("adminV1Router.removeFeatured", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete today's featured scenario entry", async () => {
    mockDb.featuredScenario.deleteMany.mockResolvedValue({ count: 1 });
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });

    const { adminV1Router } = await import("../admin");
    const handler: MutationHandler = (adminV1Router as any).removeFeatured.handler;

    const result = await handler({
      input: { scenarioId: "scenario-abc" },
      ctx: adminCtx,
    });

    expect(result).toEqual({ success: true });
    expect(mockDb.featuredScenario.deleteMany).toHaveBeenCalledWith({
      where: { scenarioId: "scenario-abc", featuredDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
    });
    expect(mockDb.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: "REMOVE_FEATURED",
        entityType: "Scenario",
        entityId: "scenario-abc",
        adminId: "admin-1",
      },
    });
  });

  it("should succeed even when no featured scenario exists", async () => {
    mockDb.featuredScenario.deleteMany.mockResolvedValue({ count: 0 });
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });

    const { adminV1Router } = await import("../admin");
    const handler: MutationHandler = (adminV1Router as any).removeFeatured.handler;

    const result = await handler({
      input: { scenarioId: "nonexistent" },
      ctx: adminCtx,
    });

    expect(result).toEqual({ success: true });
  });
});

// ---------------------------------------------------------------------------
// getFeaturedScenario
// ---------------------------------------------------------------------------
describe("adminV1Router.getFeaturedScenario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return the featured scenario with all fields", async () => {
    const mockFeatured = {
      id: "featured-1",
      featuredDate: "2026-06-20",
      scenario: {
        id: "s-1",
        title: "Test Scenario",
        description: "A test",
        playCount: 100,
        likeCount: 20,
        character: { name: "Char", avatarUrl: null },
        creator: { id: "u-1", username: "creator" },
      },
    };
    mockDb.featuredScenario.findUnique.mockResolvedValue(mockFeatured);

    const { adminV1Router } = await import("../admin");
    const handler: QueryHandler = (adminV1Router as any).getFeaturedScenario.handler;

    const result = await handler({ ctx: adminCtx });

    expect(result).toEqual(mockFeatured);
    expect(mockDb.featuredScenario.findUnique).toHaveBeenCalledWith({
      where: { featuredDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
      include: expect.objectContaining({
        scenario: expect.objectContaining({
          select: expect.objectContaining({
            character: expect.objectContaining({ select: { name: true, avatarUrl: true } }),
          }),
        }),
      }),
    });
  });
});

// ---------------------------------------------------------------------------
// moderationQueue & approveScenario / rejectScenario
// ---------------------------------------------------------------------------
describe("adminV1Router.moderationQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return pending scenarios with cursor pagination", async () => {
    const mockScenarios = [
      { id: "s-1", title: "Pending 1", moderationStatus: "PENDING", createdAt: new Date(), creator: { id: "u-1", username: "user1" }, character: { name: "Char1" } },
    ];
    mockDb.scenario.findMany.mockResolvedValue(mockScenarios);

    const { adminV1Router } = await import("../admin");
    const handler: QueryHandler = (adminV1Router as any).moderationQueue.handler;

    const result = await handler({ input: { limit: 20 }, ctx: adminCtx });

    expect(result.items).toHaveLength(1);
    expect(mockDb.scenario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { moderationStatus: "PENDING" },
        orderBy: { createdAt: "asc" },
        take: 21,
      }),
    );
  });

  it("should return empty items when no pending scenarios", async () => {
    mockDb.scenario.findMany.mockResolvedValue([]);

    const { adminV1Router } = await import("../admin");
    const handler: QueryHandler = (adminV1Router as any).moderationQueue.handler;

    const result = await handler({ input: { limit: 20 }, ctx: adminCtx });

    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeUndefined();
  });
});

describe("adminV1Router.approveScenario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should approve a pending scenario", async () => {
    mockDb.scenario.findUnique.mockResolvedValue({ id: "s-1", moderationStatus: "PENDING" });
    mockDb.scenario.update.mockResolvedValue({ id: "s-1", moderationStatus: "APPROVED" });
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });

    const { adminV1Router } = await import("../admin");
    const handler: MutationHandler = (adminV1Router as any).approveScenario.handler;

    const result = await handler({ input: { scenarioId: "s-1" }, ctx: adminCtx });

    expect(result).toEqual({ success: true });
    expect(mockDb.scenario.update).toHaveBeenCalledWith({
      where: { id: "s-1" },
      data: { moderationStatus: "APPROVED" },
    });
  });

  it("should throw NOT_FOUND when scenario does not exist", async () => {
    mockDb.scenario.findUnique.mockResolvedValue(null);

    const { adminV1Router } = await import("../admin");
    const handler: MutationHandler = (adminV1Router as any).approveScenario.handler;

    await expect(
      handler({ input: { scenarioId: "nonexistent" }, ctx: adminCtx }),
    ).rejects.toThrow("Scénario introuvable");
  });
});

describe("adminV1Router.rejectScenario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reject a pending scenario", async () => {
    mockDb.scenario.findUnique.mockResolvedValue({ id: "s-1" });
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });

    const { adminV1Router } = await import("../admin");
    const handler: MutationHandler = (adminV1Router as any).rejectScenario.handler;

    const result = await handler({ input: { scenarioId: "s-1" }, ctx: adminCtx });

    expect(result).toEqual({ success: true });
    expect(mockDb.scenario.update).toHaveBeenCalledWith({
      where: { id: "s-1" },
      data: { moderationStatus: "REJECTED" },
    });
  });
});

// ---------------------------------------------------------------------------
// moderateComment / approveComment / moderationQueueComments
// ---------------------------------------------------------------------------
describe("adminV1Router.moderateComment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reject a comment", async () => {
    mockDb.comment.findUnique.mockResolvedValue({ id: "cmt-1", moderationStatus: "PENDING" });
    mockDb.comment.update.mockResolvedValue({ id: "cmt-1" });
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });

    const { adminV1Router } = await import("../admin");
    const handler: MutationHandler = (adminV1Router as any).moderateComment.handler;

    const result = await handler({ input: { commentId: "cmt-1" }, ctx: adminCtx });

    expect(result).toEqual({ success: true });
    expect(mockDb.comment.update).toHaveBeenCalledWith({
      where: { id: "cmt-1" },
      data: {
        moderationStatus: "REJECTED",
        moderatedById: "admin-1",
        moderatedAt: expect.any(Date),
      },
    });
  });

  it("should throw NOT_FOUND when comment does not exist", async () => {
    mockDb.comment.findUnique.mockResolvedValue(null);

    const { adminV1Router } = await import("../admin");
    const handler: MutationHandler = (adminV1Router as any).moderateComment.handler;

    await expect(
      handler({ input: { commentId: "nonexistent" }, ctx: adminCtx }),
    ).rejects.toThrow("Commentaire introuvable");
  });
});

describe("adminV1Router.approveComment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should approve a comment", async () => {
    mockDb.comment.findUnique.mockResolvedValue({ id: "cmt-1" });
    mockDb.comment.update.mockResolvedValue({ id: "cmt-1" });
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });

    const { adminV1Router } = await import("../admin");
    const handler: MutationHandler = (adminV1Router as any).approveComment.handler;

    const result = await handler({ input: { commentId: "cmt-1" }, ctx: adminCtx });

    expect(result).toEqual({ success: true });
    expect(mockDb.comment.update).toHaveBeenCalledWith({
      where: { id: "cmt-1" },
      data: {
        moderationStatus: "APPROVED",
        moderatedById: "admin-1",
        moderatedAt: expect.any(Date),
      },
    });
  });
});

describe("adminV1Router.moderationQueueComments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return pending comments with user and scenario info", async () => {
    mockDb.comment.findMany.mockResolvedValue([
      { id: "cmt-1", content: "Test", moderationStatus: "PENDING", createdAt: new Date(), user: { id: "u-1", username: "user1", image: null }, scenario: { id: "s-1", title: "Scenario" } },
    ]);

    const { adminV1Router } = await import("../admin");
    const handler: QueryHandler = (adminV1Router as any).moderationQueueComments.handler;

    const result = await handler({ input: { status: "PENDING", limit: 20 }, ctx: adminCtx });

    expect(result.items).toHaveLength(1);
    expect(mockDb.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { moderationStatus: "PENDING" },
        orderBy: { createdAt: "asc" },
      }),
    );
  });
});

describe("adminV1Router.rejectComment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reject a comment by id with audit log", async () => {
    mockDb.comment.findUnique.mockResolvedValue({ id: "cmt-1" });
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });

    const { adminV1Router } = await import("../admin");
    const handler: MutationHandler = (adminV1Router as any).rejectComment.handler;

    const result = await handler({ input: { id: "cmt-1" }, ctx: adminCtx });

    expect(result).toEqual({ success: true });
    expect(mockDb.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: "REJECT_COMMENT",
        entityType: "Comment",
        entityId: "cmt-1",
        adminId: "admin-1",
      },
    });
  });
});

// ---------------------------------------------------------------------------
// getAbuseReports / dismissAbuseReport
// ---------------------------------------------------------------------------
describe("adminV1Router.getAbuseReports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return abuse reports with filtering by status", async () => {
    mockDb.abuseReport.findMany.mockResolvedValue([
      { id: "ar-1", status: "PENDING", createdAt: new Date(), reporter: { id: "u-1", username: "reporter" }, reviewedBy: null },
    ]);

    const { adminV1Router } = await import("../admin");
    const handler: QueryHandler = (adminV1Router as any).getAbuseReports.handler;

    const result = await handler({ input: { status: "PENDING" }, ctx: adminCtx });

    expect(result.items).toHaveLength(1);
    expect(mockDb.abuseReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { equals: "PENDING" } },
      }),
    );
  });
});

describe("adminV1Router.dismissAbuseReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should dismiss an abuse report", async () => {
    mockDb.abuseReport.findUnique.mockResolvedValue({ id: "ar-1", status: "PENDING" });
    mockDb.abuseReport.update.mockResolvedValue({ id: "ar-1" });
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });

    const { adminV1Router } = await import("../admin");
    const handler: MutationHandler = (adminV1Router as any).dismissAbuseReport.handler;

    const result = await handler({ input: { reportId: "ar-1" }, ctx: adminCtx });

    expect(result).toEqual({ success: true });
    expect(mockDb.abuseReport.update).toHaveBeenCalledWith({
      where: { id: "ar-1" },
      data: {
        status: "DISMISSED",
        reviewedById: "admin-1",
        reviewedAt: expect.any(Date),
      },
    });
  });

  it("should throw NOT_FOUND when report does not exist", async () => {
    mockDb.abuseReport.findUnique.mockResolvedValue(null);

    const { adminV1Router } = await import("../admin");
    const handler: MutationHandler = (adminV1Router as any).dismissAbuseReport.handler;

    await expect(
      handler({ input: { reportId: "nonexistent" }, ctx: adminCtx }),
    ).rejects.toThrow("Signalement introuvable");
  });
});

// ---------------------------------------------------------------------------
// getBlockedNumbers / blockNumber / unblockNumber
// ---------------------------------------------------------------------------
describe("adminV1Router.getBlockedNumbers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return blocked numbers with blocker info", async () => {
    mockDb.blockedNumber.findMany.mockResolvedValue([
      { id: "bn-1", phoneNumber: "+33612345678", reason: "Spam", createdAt: new Date(), blockedBy: { id: "admin-1", username: "admin" } },
    ]);

    const { adminV1Router } = await import("../admin");
    const handler: QueryHandler = (adminV1Router as any).getBlockedNumbers.handler;

    const result = await handler({ ctx: adminCtx });

    expect(result.items).toHaveLength(1);
  });
});

describe("adminV1Router.blockNumber", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should block a phone number with audit log", async () => {
    mockDb.blockedNumber.findUnique.mockResolvedValue(null);
    mockDb.blockedNumber.create.mockResolvedValue({ id: "bn-1", phoneNumber: "+33612345678" });
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });

    const { adminV1Router } = await import("../admin");
    const handler: MutationHandler = (adminV1Router as any).blockNumber.handler;

    const result = await handler({
      input: { phoneNumber: "+33612345678", reason: "Spam" },
      ctx: adminCtx,
    });

    expect(result).toEqual({ success: true, id: "bn-1" });
    expect(mockDb.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "BLOCK_NUMBER",
          entityType: "BlockedNumber",
          adminId: "admin-1",
          metadata: expect.objectContaining({
            phoneNumber: expect.stringMatching(/^blocked-/),
          }),
        }),
      }),
    );
  });

  it("should throw CONFLICT when number already blocked", async () => {
    mockDb.blockedNumber.findUnique.mockResolvedValue({ id: "bn-1", phoneNumber: "+33612345678" });

    const { adminV1Router } = await import("../admin");
    const handler: MutationHandler = (adminV1Router as any).blockNumber.handler;

    await expect(
      handler({ input: { phoneNumber: "+33612345678" }, ctx: adminCtx }),
    ).rejects.toThrow("Ce numéro est déjà bloqué");
  });
});

describe("adminV1Router.unblockNumber", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should unblock a number and log audit", async () => {
    mockDb.blockedNumber.findUnique.mockResolvedValue({ id: "bn-1", phoneNumber: "+33612345678" });
    mockDb.blockedNumber.delete.mockResolvedValue({ id: "bn-1" });
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });

    const { adminV1Router } = await import("../admin");
    const handler: MutationHandler = (adminV1Router as any).unblockNumber.handler;

    const result = await handler({ input: { id: "bn-1" }, ctx: adminCtx });

    expect(result).toEqual({ success: true });
    expect(mockDb.blockedNumber.delete).toHaveBeenCalledWith({ where: { id: "bn-1" } });
  });

  it("should throw NOT_FOUND when entry does not exist", async () => {
    mockDb.blockedNumber.findUnique.mockResolvedValue(null);

    const { adminV1Router } = await import("../admin");
    const handler: MutationHandler = (adminV1Router as any).unblockNumber.handler;

    await expect(
      handler({ input: { id: "nonexistent" }, ctx: adminCtx }),
    ).rejects.toThrow("Entrée introuvable");
  });
});

// ---------------------------------------------------------------------------
// deleteUser / getUserDetail / listUsers
// ---------------------------------------------------------------------------
describe("adminV1Router.deleteUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete a user and anonymize their data", async () => {
    mockDb.user.updateMany.mockResolvedValue({ count: 1 });
    mockDb.$transaction.mockImplementation(async (cb: Function) => {
      const mockTx = {
        user: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      };
      await cb(mockTx);
    });
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });

    const { adminV1Router } = await import("../admin");
    const handler: MutationHandler = (adminV1Router as any).deleteUser.handler;

    const result = await handler({ input: { userId: "user-1" }, ctx: adminCtx });

    expect(result).toEqual({ success: true });
    expect(mockDb.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "DELETE_USER",
          entityId: "user-1",
        }),
      }),
    );
  });

  it("should throw CONFLICT when user does not exist or already deleted", async () => {
    mockDb.user.updateMany.mockResolvedValue({ count: 0 });
    mockDb.$transaction.mockImplementation(async (cb: Function) => {
      const mockTx = {
        user: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      };
      await cb(mockTx);
    });

    const { adminV1Router } = await import("../admin");
    const handler: MutationHandler = (adminV1Router as any).deleteUser.handler;

    await expect(
      handler({ input: { userId: "nonexistent" }, ctx: adminCtx }),
    ).rejects.toThrow("Utilisateur introuvable ou déjà supprimé");
  });
});

describe("adminV1Router.getUserDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return user detail with merged fields", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: "u-1",
      email: "test@example.com",
      username: "testuser",
      role: "USER",
      consentAcceptedAt: new Date(),
      deletedAt: null,
      createdAt: new Date(),
      displayName: null,
      credits: 10,
      totalLikesReceived: 5,
      totalCallsMade: 3,
      profile: { displayName: "Display", image: null, bio: null },
      billing: { credits: 100 },
      social: { totalLikesReceived: 50, totalCallsMade: 30 },
      _count: { scenarios: 2, calls: 10, comments: 5, reactions: 8 },
    });

    const { adminV1Router } = await import("../admin");
    const handler: QueryHandler = (adminV1Router as any).getUserDetail.handler;

    const result = await handler({ input: { userId: "u-1" }, ctx: adminCtx });

    expect(result.id).toBe("u-1");
    // Should use sub-aggregate values
    expect(result.credits).toBe(100);
    expect(result.totalLikesReceived).toBe(50);
    expect(result.totalCallsMade).toBe(30);
    expect(result._count.scenarios).toBe(2);
  });

  it("should throw NOT_FOUND when user does not exist", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);

    const { adminV1Router } = await import("../admin");
    const handler: QueryHandler = (adminV1Router as any).getUserDetail.handler;

    await expect(
      handler({ input: { userId: "nonexistent" }, ctx: adminCtx }),
    ).rejects.toThrow("Utilisateur introuvable");
  });
});

describe("adminV1Router.listUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return paginated user list with merged fields", async () => {
    mockDb.user.findMany.mockResolvedValue([
      {
        id: "u-1",
        email: "test@example.com",
        username: "testuser",
        role: "USER",
        deletedAt: null,
        createdAt: new Date(),
        credits: 10,
        totalCallsMade: 3,
        billing: { credits: 100 },
        social: { totalCallsMade: 30 },
        _count: { scenarios: 2, calls: 10 },
      },
    ]);

    const { adminV1Router } = await import("../admin");
    const handler: QueryHandler = (adminV1Router as any).listUsers.handler;

    const result = await handler({ input: { limit: 20 }, ctx: adminCtx });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].credits).toBe(100);
    expect(result.items[0].totalCallsMade).toBe(30);
  });

  it("should support search filtering", async () => {
    mockDb.user.findMany.mockResolvedValue([]);

    const { adminV1Router } = await import("../admin");
    const handler: QueryHandler = (adminV1Router as any).listUsers.handler;

    await handler({ input: { search: "test", limit: 20 }, ctx: adminCtx });

    expect(mockDb.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { username: { contains: "test", mode: "insensitive" } },
            { email: { contains: "test", mode: "insensitive" } },
          ],
        },
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// purgeGDPR
// ---------------------------------------------------------------------------
describe("adminV1Router.purgeGDPR", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call purgeAnonymizedUsers with retention days", async () => {
    const { purgeAnonymizedUsers } = await import("@/server/jobs/gdprPurge");
    (purgeAnonymizedUsers as any).mockResolvedValue({ purged: 5 });

    const { adminV1Router } = await import("../admin");
    const handler: MutationHandler = (adminV1Router as any).purgeGDPR.handler;

    const result = await handler({ input: { retentionDays: 30 }, ctx: adminCtx });

    expect(purgeAnonymizedUsers).toHaveBeenCalledWith(30);
  });
});
