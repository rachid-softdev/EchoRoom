import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// ---------------------------------------------------------------------------
// communityRouter tests
// ---------------------------------------------------------------------------
// Tests for community.ts:
//   - comment: creates PENDING comment, spam detect → TOO_MANY_REQUESTS, async moderation
//   - getComments: returns only APPROVED, pagination, empty scenarios
//   - reportAbuse: creates report, double report → CONFLICT

// ---------------------------------------------------------------------------
// Mocks — we mock @/server/procedures directly to avoid complex re-export chain.
// Community.ts imports:
//   router, publicProcedure, protectedProcedure, withRateLimit,
//   withContentModeration, withIPRateLimit from "../procedures"
// ---------------------------------------------------------------------------

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
    error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn(),
  })),
}));

// Mock db
const mockDb = {
  comment: { create: vi.fn(), findMany: vi.fn() },
  abuseReport: { findFirst: vi.fn(), create: vi.fn() },
};

vi.mock("@/server/db", () => ({
  db: mockDb,
}));

const mockDetectCommentSpam = vi.fn();
vi.mock("@/server/services/security/spamDetection", () => ({
  detectCommentSpam: mockDetectCommentSpam,
}));

const mockScheduleAsyncModeration = vi.fn();
vi.mock("@/server/services/ai/asyncModeration", () => ({
  scheduleAsyncModeration: mockScheduleAsyncModeration,
}));

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

type Ctx = { session: { user: { id: string } } };

function getHandler(routeName: string): Function {
  // The router mock captures all route handlers directly
  // This is loaded lazily inside each test to avoid module resolution issues
  return vi.importActual<Record<string, any>>("../community").then(
    (mod: any) => mod.communityRouter[routeName].handler
  );
}

describe("communityRouter.comment", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should create a PENDING comment with user relation", async () => {
    mockDetectCommentSpam.mockResolvedValue({ flagged: false });
    mockDb.comment.create.mockResolvedValue({
      id: "comment-1", userId: "user-1", scenarioId: "scenario-1",
      content: "Super scénario !", moderationStatus: "PENDING",
      user: { id: "user-1", username: "alice", image: null },
    });

    const { communityRouter } = await import("../community");
    const handler = (communityRouter as any).comment.handler;

    const result = await handler({
      input: { scenarioId: "scenario-1", content: "Super scénario !" },
      ctx: { session: { user: { id: "user-1" } } },
    });

    expect(result.moderationStatus).toBe("PENDING");
    expect(result.user.username).toBe("alice");
    expect(mockDb.comment.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1", scenarioId: "scenario-1",
        content: "Super scénario !", moderationStatus: "PENDING",
      },
      include: { user: { select: { id: true, username: true, image: true } } },
    });
  });

  it("should throw TOO_MANY_REQUESTS when spam is detected", async () => {
    mockDetectCommentSpam.mockResolvedValue({ flagged: true, reason: "Trop de spam" });

    const { communityRouter } = await import("../community");
    const handler = (communityRouter as any).comment.handler;

    try {
      await handler({
        input: { scenarioId: "s1", content: "Spam" },
        ctx: { session: { user: { id: "user-1" } } },
      });
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("TOO_MANY_REQUESTS");
    }
    expect(mockDb.comment.create).not.toHaveBeenCalled();
  });

  it("should call spam detection with userId and content", async () => {
    mockDetectCommentSpam.mockResolvedValue({ flagged: false });
    mockDb.comment.create.mockResolvedValue({
      id: "c1", userId: "u1", scenarioId: "s1", content: "Hello",
      moderationStatus: "PENDING",
      user: { id: "u1", username: "u1", image: null },
    });

    const { communityRouter } = await import("../community");
    const handler = (communityRouter as any).comment.handler;

    await handler({
      input: { scenarioId: "s1", content: "Hello world" },
      ctx: { session: { user: { id: "user-1" } } },
    });

    expect(mockDetectCommentSpam).toHaveBeenCalledWith("user-1", "Hello world");
  });

  it("should call scheduleAsyncModeration after creating comment", async () => {
    mockDetectCommentSpam.mockResolvedValue({ flagged: false });
    mockDb.comment.create.mockResolvedValue({
      id: "comment-42", userId: "u1", scenarioId: "s1",
      content: "Moderate me", moderationStatus: "PENDING",
      user: { id: "u1", username: "u1", image: null },
    });

    const { communityRouter } = await import("../community");
    const handler = (communityRouter as any).comment.handler;

    await handler({
      input: { scenarioId: "s1", content: "Moderate me" },
      ctx: { session: { user: { id: "user-1" } } },
    });

    expect(mockScheduleAsyncModeration).toHaveBeenCalledWith("Moderate me", {
      type: "comment",
      id: "comment-42",
    });
  });

  it("should use default reason when spam reason is undefined", async () => {
    mockDetectCommentSpam.mockResolvedValue({ flagged: true, reason: undefined });

    const { communityRouter } = await import("../community");
    const handler = (communityRouter as any).comment.handler;

    try {
      await handler({
        input: { scenarioId: "s1", content: "Spam" },
        ctx: { session: { user: { id: "user-1" } } },
      });
      expect.fail("Should have thrown");
    } catch (error) {
      expect((error as TRPCError).code).toBe("TOO_MANY_REQUESTS");
      expect((error as TRPCError).message).toBe("Trop de requêtes");
    }
  });
});

describe("communityRouter.getComments", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should query only APPROVED comments", async () => {
    mockDb.comment.findMany.mockResolvedValue([]);

    const { communityRouter } = await import("../community");
    const handler = (communityRouter as any).getComments.handler;

    await handler({ input: { scenarioId: "s1", limit: 20 } });

    expect(mockDb.comment.findMany).toHaveBeenCalledWith({
      where: { scenarioId: "s1", moderationStatus: "APPROVED" },
      take: 21,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, username: true, image: true } } },
    });
  });

  it("should return empty result when no comments", async () => {
    mockDb.comment.findMany.mockResolvedValue([]);

    const { communityRouter } = await import("../community");
    const handler = (communityRouter as any).getComments.handler;

    const result = await handler({ input: { scenarioId: "nonexistent", limit: 20 } });
    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeUndefined();
  });

  it("should support cursor pagination with skip", async () => {
    const comments = Array.from({ length: 11 }, (_, i) => ({
      id: `c${i}`, scenarioId: "s1", content: `C${i}`,
      moderationStatus: "APPROVED", userId: `u${i}`,
      createdAt: new Date(),
      user: { id: `u${i}`, username: `u${i}`, image: null },
    }));
    mockDb.comment.findMany.mockResolvedValue(comments);

    const { communityRouter } = await import("../community");
    const handler = (communityRouter as any).getComments.handler;

    const result = await handler({ input: { scenarioId: "s1", limit: 10, cursor: "c0" } });

    expect(result.items).toHaveLength(10);
    expect(result.nextCursor).toBe("c9");
    expect(mockDb.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 1, cursor: { id: "c0" }, take: 11 }),
    );
  });

  it("should not have nextCursor when all data fits", async () => {
    mockDb.comment.findMany.mockResolvedValue([
      { id: "c1", scenarioId: "s1", content: "X", moderationStatus: "APPROVED", userId: "u1", createdAt: new Date(), user: { id: "u1", username: "u1", image: null } },
    ]);

    const { communityRouter } = await import("../community");
    const handler = (communityRouter as any).getComments.handler;

    const result = await handler({ input: { scenarioId: "s1", limit: 10 } });
    expect(result.nextCursor).toBeUndefined();
  });

  it("should handle limit=1 boundary", async () => {
    mockDb.comment.findMany.mockResolvedValue([]);

    const { communityRouter } = await import("../community");
    const handler = (communityRouter as any).getComments.handler;

    await handler({ input: { scenarioId: "s1", limit: 1 } });
    expect(mockDb.comment.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 2 }));
  });

  it("should accept limit=20 and call with take=21", async () => {
    mockDb.comment.findMany.mockResolvedValue([]);

    const { communityRouter } = await import("../community");
    const handler = (communityRouter as any).getComments.handler;

    // Note: limit is defaulted by Zod schema to 20 at the tRPC layer.
    // When calling the handler directly (bypassing Zod), we must provide it.
    await handler({ input: { scenarioId: "s1", limit: 20 } });
    expect(mockDb.comment.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 21 }));
  });
});

describe("communityRouter.reportAbuse", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should create report when no pending exists", async () => {
    mockDb.abuseReport.findFirst.mockResolvedValue(null);
    mockDb.abuseReport.create.mockResolvedValue({ id: "r1" });

    const { communityRouter } = await import("../community");
    const handler = (communityRouter as any).reportAbuse.handler;

    const result = await handler({
      input: { targetType: "scenario", targetId: "s1", reason: "Contenu inapproprié" },
      ctx: { session: { user: { id: "u1" } } },
    });

    expect(result).toEqual({ reportId: "r1" });
    expect(mockDb.abuseReport.findFirst).toHaveBeenCalledWith({
      where: { reporterId: "u1", targetType: "scenario", targetId: "s1", status: "PENDING" },
    });
    expect(mockDb.abuseReport.create).toHaveBeenCalledWith({
      data: { reporterId: "u1", targetType: "scenario", targetId: "s1", reason: "Contenu inapproprié" },
    });
  });

  it("should throw CONFLICT on duplicate pending report", async () => {
    mockDb.abuseReport.findFirst.mockResolvedValue({
      id: "existing", reporterId: "u1", targetType: "scenario", targetId: "s1", status: "PENDING",
    });

    const { communityRouter } = await import("../community");
    const handler = (communityRouter as any).reportAbuse.handler;

    try {
      await handler({
        input: { targetType: "scenario", targetId: "s1", reason: "Double" },
        ctx: { session: { user: { id: "u1" } } },
      });
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("CONFLICT");
    }
    expect(mockDb.abuseReport.create).not.toHaveBeenCalled();
  });

  it("should allow new report after previous was dismissed", async () => {
    mockDb.abuseReport.findFirst.mockResolvedValue(null);
    mockDb.abuseReport.create.mockResolvedValue({ id: "r2" });

    const { communityRouter } = await import("../community");
    const handler = (communityRouter as any).reportAbuse.handler;

    const result = await handler({
      input: { targetType: "comment", targetId: "c42", reason: "Nouveau signalement" },
      ctx: { session: { user: { id: "u1" } } },
    });

    expect(result.reportId).toBe("r2");
  });

  it("should pass correct target data to db queries", async () => {
    mockDb.abuseReport.findFirst.mockResolvedValue(null);
    mockDb.abuseReport.create.mockResolvedValue({ id: "r3" });

    const { communityRouter } = await import("../community");
    const handler = (communityRouter as any).reportAbuse.handler;

    await handler({
      input: { targetType: "user", targetId: "bad-user", reason: "Comportement abusif" },
      ctx: { session: { user: { id: "reporter-1" } } },
    });

    expect(mockDb.abuseReport.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ targetType: "user", targetId: "bad-user" }),
      }),
    );
    expect(mockDb.abuseReport.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ reporterId: "reporter-1", targetType: "user", targetId: "bad-user" }),
    });
  });
});
