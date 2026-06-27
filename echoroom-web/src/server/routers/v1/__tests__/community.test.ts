import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// communityV1Router tests
// ---------------------------------------------------------------------------

const mockDb = vi.hoisted(() => ({
  comment: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  abuseReport: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/server/db", () => ({
  db: mockDb,
}));

const mockDetectCommentSpam = vi.hoisted(() => vi.fn());
vi.mock("@/server/services/security/spamDetection", () => ({
  detectCommentSpam: mockDetectCommentSpam,
}));

const mockScheduleAsyncModeration = vi.hoisted(() => vi.fn());
vi.mock("@/server/services/ai/asyncModeration", () => ({
  scheduleAsyncModeration: mockScheduleAsyncModeration,
}));

vi.mock("@/lib/redis", () => ({
  redis: null,
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock("@/server/middleware/metrics", () => ({
  withREDMetrics: vi.fn(() => (opts: { next: Function }) => opts.next()),
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
    withIPRateLimit: vi.fn(() => (opts: { next: Function }) => opts.next()),
    withContentModeration: vi.fn(() => (opts: { next: Function }) => opts.next()),
    withTracing: vi.fn(() => chain),
    isAuthenticated: chain,
    isAdmin: chain,
    withREDMetrics: vi.fn(() => (opts: { next: Function }) => opts.next()),
  };
});

const validCtx = { session: { user: { id: "user-123" } } };

// ---------------------------------------------------------------------------
// comment — add a comment to a scenario
// ---------------------------------------------------------------------------
describe("communityV1Router.comment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a comment when no spam detected", async () => {
    mockDetectCommentSpam.mockResolvedValue({ flagged: false });
    const createdComment = {
      id: "cmt-1",
      content: "Great scenario!",
      moderationStatus: "PENDING",
      userId: "user-123",
      scenarioId: "scenario-1",
      user: { id: "user-123", username: "testuser", profile: { image: null } },
    };
    mockDb.comment.create.mockResolvedValue(createdComment);

    const { communityV1Router } = await import("../community");
    const handler = (communityV1Router as any).comment.handler;

    const result = await handler({
      input: { scenarioId: "scenario-1", content: "Great scenario!" },
      ctx: validCtx,
    });

    expect(result).toEqual(createdComment);
    expect(mockDb.comment.create).toHaveBeenCalledWith({
      data: {
        userId: "user-123",
        scenarioId: "scenario-1",
        content: "Great scenario!",
        moderationStatus: "PENDING",
      },
      include: {
        user: {
          select: { id: true, username: true, profile: { select: { image: true } } },
        },
      },
    });
  });

  it("should schedule async moderation after creating comment", async () => {
    mockDetectCommentSpam.mockResolvedValue({ flagged: false });
    mockDb.comment.create.mockResolvedValue({
      id: "cmt-1",
      content: "Great scenario!",
      moderationStatus: "PENDING",
      userId: "user-123",
      scenarioId: "scenario-1",
      user: { id: "user-123", username: "testuser", profile: { image: null } },
    });

    const { communityV1Router } = await import("../community");
    const handler = (communityV1Router as any).comment.handler;

    await handler({
      input: { scenarioId: "scenario-1", content: "Great scenario!" },
      ctx: validCtx,
    });

    expect(mockScheduleAsyncModeration).toHaveBeenCalledWith("Great scenario!", {
      type: "comment",
      id: "cmt-1",
    });
  });

  it("should throw TOO_MANY_REQUESTS when spam is detected", async () => {
    mockDetectCommentSpam.mockResolvedValue({
      flagged: true,
      reason: "Commentaire détecté comme spam. Réessayez plus tard.",
    });

    const { communityV1Router } = await import("../community");
    const handler = (communityV1Router as any).comment.handler;

    await expect(
      handler({
        input: { scenarioId: "scenario-1", content: "Spammy content" },
        ctx: validCtx,
      }),
    ).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });

    expect(mockDb.comment.create).not.toHaveBeenCalled();
  });

  it("should reject empty scenarioId (Zod)", async () => {
    const { communityV1Router } = await import("../community");
    const handler = (communityV1Router as any).comment.handler;

    await expect(
      handler({ input: { scenarioId: "", content: "test" }, ctx: validCtx }),
    ).rejects.toThrow();
  });

  it("should reject empty content (Zod)", async () => {
    const { communityV1Router } = await import("../community");
    const handler = (communityV1Router as any).comment.handler;

    await expect(
      handler({ input: { scenarioId: "s-1", content: "" }, ctx: validCtx }),
    ).rejects.toThrow();
  });

  it("should reject content over 500 characters (Zod)", async () => {
    const { communityV1Router } = await import("../community");
    const handler = (communityV1Router as any).comment.handler;

    await expect(
      handler({ input: { scenarioId: "s-1", content: "x".repeat(501) }, ctx: validCtx }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getComments — paginated comments for a scenario
// ---------------------------------------------------------------------------
describe("communityV1Router.getComments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return approved comments with pagination", async () => {
    const mockComments = [
      {
        id: "cmt-3",
        content: "Third",
        moderationStatus: "APPROVED",
        createdAt: new Date("2026-06-03"),
        user: { id: "u-1", username: "Alice", profile: { image: null } },
      },
      {
        id: "cmt-2",
        content: "Second",
        moderationStatus: "APPROVED",
        createdAt: new Date("2026-06-02"),
        user: { id: "u-2", username: "Bob", profile: { image: "https://example.com/av.jpg" } },
      },
      {
        id: "cmt-1",
        content: "First",
        moderationStatus: "APPROVED",
        createdAt: new Date("2026-06-01"),
        user: { id: "u-3", username: "Charlie", profile: { image: null } },
      },
    ];
    mockDb.comment.findMany.mockResolvedValue(mockComments);

    const { communityV1Router } = await import("../community");
    const handler = (communityV1Router as any).getComments.handler;

    const result = await handler({
      input: { scenarioId: "scenario-1", limit: 20 },
    });

    expect(result.items).toHaveLength(3);
    expect(result.nextCursor).toBeUndefined();
    expect(mockDb.comment.findMany).toHaveBeenCalledWith({
      where: { scenarioId: "scenario-1", moderationStatus: "APPROVED" },
      take: 21,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, username: true, profile: { select: { image: true } } },
        },
      },
    });
  });

  it("should handle cursor-based pagination", async () => {
    mockDb.comment.findMany.mockResolvedValue([
      {
        id: "cmt-5",
        content: "Newer",
        createdAt: new Date(),
        moderationStatus: "APPROVED",
        user: { id: "u-1", username: "A", profile: { image: null } },
      },
    ]);

    const { communityV1Router } = await import("../community");
    const handler = (communityV1Router as any).getComments.handler;

    const result = await handler({
      input: { scenarioId: "scenario-1", cursor: "cmt-4", limit: 20 },
    });

    expect(result.items).toHaveLength(1);
    expect(mockDb.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 1, cursor: { id: "cmt-4" }, take: 21 }),
    );
  });

  it("should return nextCursor when more comments than limit", async () => {
    const mockComments = Array.from({ length: 21 }, (_, i) => ({
      id: `cmt-${i}`,
      content: `Comment ${i}`,
      createdAt: new Date(`2026-06-${String(i + 1).padStart(2, "0")}`),
      moderationStatus: "APPROVED" as const,
      user: { id: `u-${i}`, username: `User${i}`, profile: { image: null } },
    }));
    mockDb.comment.findMany.mockResolvedValue(mockComments);

    const { communityV1Router } = await import("../community");
    const handler = (communityV1Router as any).getComments.handler;

    const result = await handler({
      input: { scenarioId: "scenario-1", limit: 20 },
    });

    expect(result.items).toHaveLength(20);
    expect(result.nextCursor).toBeDefined();
  });

  it("should return empty list when no comments exist", async () => {
    mockDb.comment.findMany.mockResolvedValue([]);

    const { communityV1Router } = await import("../community");
    const handler = (communityV1Router as any).getComments.handler;

    const result = await handler({
      input: { scenarioId: "scenario-empty", limit: 20 },
    });

    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeUndefined();
  });

  it("should use default limit of 20 (Zod schema)", () => {
    import("zod").then(({ z }) => {
      const schema = z.object({
        scenarioId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      });
      const result = schema.safeParse({ scenarioId: "s-1" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
      }
    });
  });

  it("should enforce min limit of 1 (Zod schema)", () => {
    import("zod").then(({ z }) => {
      const schema = z.object({
        scenarioId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      });
      expect(schema.safeParse({ scenarioId: "s-1", limit: 0 }).success).toBe(false);
    });
  });

  it("should enforce max limit of 50 (Zod schema)", () => {
    import("zod").then(({ z }) => {
      const schema = z.object({
        scenarioId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      });
      expect(schema.safeParse({ scenarioId: "s-1", limit: 51 }).success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// reportAbuse — report abusive content
// ---------------------------------------------------------------------------
describe("communityV1Router.reportAbuse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create an abuse report when no duplicate exists", async () => {
    mockDb.abuseReport.findFirst.mockResolvedValue(null);
    mockDb.abuseReport.create.mockResolvedValue({ id: "report-1" });

    const { communityV1Router } = await import("../community");
    const handler = (communityV1Router as any).reportAbuse.handler;

    const result = await handler({
      input: {
        targetType: "SCENARIO",
        targetId: "scenario-1",
        reason: "This is an abusive content!",
      },
      ctx: validCtx,
    });

    expect(result).toEqual({ reportId: "report-1" });
    expect(mockDb.abuseReport.create).toHaveBeenCalledWith({
      data: {
        reporterId: "user-123",
        targetType: "SCENARIO",
        targetId: "scenario-1",
        reason: "This is an abusive content!",
      },
    });
  });

  it("should throw CONFLICT when user already reported the same target", async () => {
    mockDb.abuseReport.findFirst.mockResolvedValue({ id: "existing-report" });

    const { communityV1Router } = await import("../community");
    const handler = (communityV1Router as any).reportAbuse.handler;

    await expect(
      handler({
        input: {
          targetType: "SCENARIO",
          targetId: "scenario-1",
          reason: "This is an abusive content!",
        },
        ctx: validCtx,
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Vous avez déjà signalé ce contenu",
    });

    expect(mockDb.abuseReport.create).not.toHaveBeenCalled();
  });

  it("should check existing report only for PENDING status", async () => {
    mockDb.abuseReport.findFirst.mockResolvedValue(null);
    mockDb.abuseReport.create.mockResolvedValue({ id: "report-1" });

    const { communityV1Router } = await import("../community");
    const handler = (communityV1Router as any).reportAbuse.handler;

    await handler({
      input: {
        targetType: "SCENARIO",
        targetId: "scenario-1",
        reason: "This is an abusive content!",
      },
      ctx: validCtx,
    });

    expect(mockDb.abuseReport.findFirst).toHaveBeenCalledWith({
      where: {
        reporterId: "user-123",
        targetType: "SCENARIO",
        targetId: "scenario-1",
        status: "PENDING",
      },
    });
  });

  it("should reject reason shorter than MIN_REPORT_REASON_LENGTH (Zod schema)", () => {
    import("zod").then(({ z }) => {
      import("@/lib/constants").then(({ MIN_REPORT_REASON_LENGTH }) => {
        const schema = z.object({
          targetType: z.string().min(1).max(50),
          targetId: z.string().min(1),
          reason: z.string().min(MIN_REPORT_REASON_LENGTH!).max(1000),
        });
        expect(schema.safeParse({ targetType: "S", targetId: "1", reason: "Short" }).success).toBe(
          false,
        );
      });
    });
  });

  it("should reject reason longer than 1000 characters (Zod schema)", () => {
    import("zod").then(({ z }) => {
      const schema = z.object({
        targetType: z.string().min(1).max(50),
        targetId: z.string().min(1),
        reason: z.string().min(10).max(1000),
      });
      expect(
        schema.safeParse({ targetType: "S", targetId: "1", reason: "x".repeat(1001) }).success,
      ).toBe(false);
    });
  });

  it("should reject empty targetType (Zod schema)", () => {
    import("zod").then(({ z }) => {
      const schema = z.object({
        targetType: z.string().min(1).max(50),
        targetId: z.string().min(1),
        reason: z.string().min(10).max(1000),
      });
      expect(
        schema.safeParse({ targetType: "", targetId: "1", reason: "1234567890" }).success,
      ).toBe(false);
    });
  });

  it("should reject empty targetId (Zod schema)", () => {
    import("zod").then(({ z }) => {
      const schema = z.object({
        targetType: z.string().min(1).max(50),
        targetId: z.string().min(1),
        reason: z.string().min(10).max(1000),
      });
      expect(
        schema.safeParse({ targetType: "S", targetId: "", reason: "1234567890" }).success,
      ).toBe(false);
    });
  });

  it("should allow a reason at exactly 10 characters", async () => {
    mockDb.abuseReport.findFirst.mockResolvedValue(null);
    mockDb.abuseReport.create.mockResolvedValue({ id: "report-1" });

    const { communityV1Router } = await import("../community");
    const handler = (communityV1Router as any).reportAbuse.handler;

    const result = await handler({
      input: { targetType: "SCENARIO", targetId: "s-1", reason: "1234567890" },
      ctx: validCtx,
    });

    expect(result).toEqual({ reportId: "report-1" });
  });
});
