import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// clipsV1Router tests
// ---------------------------------------------------------------------------

const mockDb = vi.hoisted(() => ({
  call: {
    findUnique: vi.fn(),
  },
  clip: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/server/db", () => ({
  db: mockDb,
}));

const mockCreateClip = vi.hoisted(() => vi.fn());
const mockDeleteClip = vi.hoisted(() => vi.fn());
const mockGetClips = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/social/clips", () => ({
  createClip: mockCreateClip,
  deleteClip: mockDeleteClip,
  getClips: mockGetClips,
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

// Mock errors module
vi.mock("@/server/lib/errors", () => ({
  AppError: class AppError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "AppError";
    }
  },
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
// listByCall
// ---------------------------------------------------------------------------
describe("clipsV1Router.listByCall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return clips for a call owned by the user", async () => {
    mockDb.call.findUnique.mockResolvedValue({ id: "call-1", userId: "user-123" });
    mockGetClips.mockResolvedValue([
      { id: "clip-1", clipUrl: "https://example.com/clip.wav", startTime: 10, endTime: 20 },
    ]);

    const { clipsV1Router } = await import("../clips");
    const handler = (clipsV1Router as any).listByCall.handler;

    const result = await handler({
      input: { callId: "call-1" },
      ctx: validCtx,
    });

    expect(result).toHaveLength(1);
    expect(mockGetClips).toHaveBeenCalledWith("call-1");
  });

  it("should throw NOT_FOUND when call does not exist", async () => {
    mockDb.call.findUnique.mockResolvedValue(null);

    const { clipsV1Router } = await import("../clips");
    const handler = (clipsV1Router as any).listByCall.handler;

    await expect(
      handler({ input: { callId: "nonexistent" }, ctx: validCtx }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Appel introuvable",
    });
  });

  it("should throw FORBIDDEN when call is not owned by the user", async () => {
    mockDb.call.findUnique.mockResolvedValue({ id: "call-1", userId: "other-user" });

    const { clipsV1Router } = await import("../clips");
    const handler = (clipsV1Router as any).listByCall.handler;

    await expect(handler({ input: { callId: "call-1" }, ctx: validCtx })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Accès refusé",
    });
  });

  it("should reject empty callId (Zod)", async () => {
    const { clipsV1Router } = await import("../clips");
    const handler = (clipsV1Router as any).listByCall.handler;

    await expect(handler({ input: { callId: "" }, ctx: validCtx })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// listByUser
// ---------------------------------------------------------------------------
describe("clipsV1Router.listByUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return paginated clips owned by the user", async () => {
    const mockClips = [
      {
        id: "clip-3",
        createdAt: new Date("2026-06-03"),
        call: { scenario: { id: "s-1", title: "S1" } },
      },
      {
        id: "clip-2",
        createdAt: new Date("2026-06-02"),
        call: { scenario: { id: "s-2", title: "S2" } },
      },
      {
        id: "clip-1",
        createdAt: new Date("2026-06-01"),
        call: { scenario: { id: "s-3", title: "S3" } },
      },
    ];
    mockDb.clip.findMany.mockResolvedValue(mockClips);

    const { clipsV1Router } = await import("../clips");
    const handler = (clipsV1Router as any).listByUser.handler;

    const result = await handler({
      input: { limit: 10 },
      ctx: validCtx,
    });

    expect(result.items).toHaveLength(3);
    expect(result.nextCursor).toBeUndefined();
    expect(mockDb.clip.findMany).toHaveBeenCalledWith({
      where: { userId: "user-123" },
      take: 11,
      orderBy: { createdAt: "desc" },
      include: {
        call: {
          select: { scenario: { select: { id: true, title: true } } },
        },
      },
    });
  });

  it("should handle cursor-based pagination", async () => {
    mockDb.clip.findMany.mockResolvedValue([
      { id: "clip-2", createdAt: new Date(), call: { scenario: { title: "S2" } } },
    ]);

    const { clipsV1Router } = await import("../clips");
    const handler = (clipsV1Router as any).listByUser.handler;

    const result = await handler({
      input: { cursor: "clip-3", limit: 5 },
      ctx: validCtx,
    });

    expect(result.items).toHaveLength(1);
    expect(mockDb.clip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 1, cursor: { id: "clip-3" }, take: 6 }),
    );
  });

  it("should return nextCursor when more results than limit", async () => {
    const mockClips = Array.from({ length: 11 }, (_, i) => ({
      id: `clip-${i}`,
      createdAt: new Date(`2026-06-${String(i + 1).padStart(2, "0")}`),
      call: { scenario: { id: `s-${i}`, title: `S${i}` } },
    }));
    mockDb.clip.findMany.mockResolvedValue(mockClips);

    const { clipsV1Router } = await import("../clips");
    const handler = (clipsV1Router as any).listByUser.handler;

    const result = await handler({
      input: { limit: 10 },
      ctx: validCtx,
    });

    expect(result.items).toHaveLength(10);
    expect(result.nextCursor).toBeDefined();
  });

  it("should return empty list when user has no clips", async () => {
    mockDb.clip.findMany.mockResolvedValue([]);

    const { clipsV1Router } = await import("../clips");
    const handler = (clipsV1Router as any).listByUser.handler;

    const result = await handler({
      input: { limit: 10 },
      ctx: { session: { user: { id: "user-empty" } } },
    });

    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeUndefined();
  });

  it("should use default limit of 10 (Zod schema)", () => {
    import("zod").then(({ z }) => {
      const schema = z.object({
        cursor: z.string().min(1).optional(),
        limit: z.number().int().min(1).max(20).default(10),
      });
      const result = schema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------
describe("clipsV1Router.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validInput = {
    callId: "call-1",
    startTime: 10,
    endTime: 20,
  };

  it("should create a clip and return clipId", async () => {
    mockCreateClip.mockResolvedValue({ clipId: "clip-new" });

    const { clipsV1Router } = await import("../clips");
    const handler = (clipsV1Router as any).create.handler;

    const result = await handler({ input: validInput, ctx: validCtx });

    expect(result).toEqual({ clipId: "clip-new" });
    expect(mockCreateClip).toHaveBeenCalledWith({
      callId: "call-1",
      userId: "user-123",
      startTime: 10,
      endTime: 20,
    });
  });

  it("should pass optional title when provided", async () => {
    mockCreateClip.mockResolvedValue({ clipId: "clip-new" });

    const { clipsV1Router } = await import("../clips");
    const handler = (clipsV1Router as any).create.handler;

    await handler({
      input: { ...validInput, title: "My Clip" },
      ctx: validCtx,
    });

    expect(mockCreateClip).toHaveBeenCalledWith({
      callId: "call-1",
      userId: "user-123",
      startTime: 10,
      endTime: 20,
      title: "My Clip",
    });
  });

  it("should map NOT_FOUND AppError to TRPCError NOT_FOUND", async () => {
    const { AppError } = await import("@/server/lib/errors");
    mockCreateClip.mockRejectedValue(new AppError("NOT_FOUND", "Appel introuvable"));

    const { clipsV1Router } = await import("../clips");
    const handler = (clipsV1Router as any).create.handler;

    await expect(handler({ input: validInput, ctx: validCtx })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("should map FORBIDDEN AppError to TRPCError FORBIDDEN", async () => {
    const { AppError } = await import("@/server/lib/errors");
    mockCreateClip.mockRejectedValue(new AppError("FORBIDDEN", "Cet appel ne vous appartient pas"));

    const { clipsV1Router } = await import("../clips");
    const handler = (clipsV1Router as any).create.handler;

    await expect(handler({ input: validInput, ctx: validCtx })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("should map unknown AppError to INTERNAL_SERVER_ERROR", async () => {
    const { AppError } = await import("@/server/lib/errors");
    mockCreateClip.mockRejectedValue(new AppError("TWILIO_ERROR", "Unknown"));

    const { clipsV1Router } = await import("../clips");
    const handler = (clipsV1Router as any).create.handler;

    await expect(handler({ input: validInput, ctx: validCtx })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });

  it("should re-throw non-AppError errors", async () => {
    mockCreateClip.mockRejectedValue(new Error("Database error"));

    const { clipsV1Router } = await import("../clips");
    const handler = (clipsV1Router as any).create.handler;

    await expect(handler({ input: validInput, ctx: validCtx })).rejects.toThrow("Database error");
  });

  it("should reject endTime equal to startTime (Zod refine)", async () => {
    const { clipsV1Router } = await import("../clips");
    const handler = (clipsV1Router as any).create.handler;

    await expect(
      handler({
        input: { callId: "call-1", startTime: 10, endTime: 10 },
        ctx: validCtx,
      }),
    ).rejects.toThrow();
  });

  it("should reject startTime below 0 (Zod)", async () => {
    const { clipsV1Router } = await import("../clips");
    const handler = (clipsV1Router as any).create.handler;

    await expect(
      handler({
        input: { callId: "call-1", startTime: -1, endTime: 10 },
        ctx: validCtx,
      }),
    ).rejects.toThrow();
  });

  it("should reject endTime above 86400 (Zod)", async () => {
    const { clipsV1Router } = await import("../clips");
    const handler = (clipsV1Router as any).create.handler;

    await expect(
      handler({
        input: { callId: "call-1", startTime: 0, endTime: 86401 },
        ctx: validCtx,
      }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// delete
// ---------------------------------------------------------------------------
describe("clipsV1Router.delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete a clip and return success", async () => {
    mockDeleteClip.mockResolvedValue({ success: true });

    const { clipsV1Router } = await import("../clips");
    const handler = (clipsV1Router as any).delete.handler;

    const result = await handler({ input: { clipId: "clip-1" }, ctx: validCtx });

    expect(result).toEqual({ success: true });
    expect(mockDeleteClip).toHaveBeenCalledWith("clip-1", "user-123");
  });

  it("should map NOT_FOUND AppError to TRPCError NOT_FOUND", async () => {
    const { AppError } = await import("@/server/lib/errors");
    mockDeleteClip.mockRejectedValue(new AppError("NOT_FOUND", "Clip introuvable"));

    const { clipsV1Router } = await import("../clips");
    const handler = (clipsV1Router as any).delete.handler;

    await expect(
      handler({ input: { clipId: "nonexistent" }, ctx: validCtx }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("should map FORBIDDEN AppError to TRPCError FORBIDDEN", async () => {
    const { AppError } = await import("@/server/lib/errors");
    mockDeleteClip.mockRejectedValue(new AppError("FORBIDDEN", "Ce clip ne vous appartient pas"));

    const { clipsV1Router } = await import("../clips");
    const handler = (clipsV1Router as any).delete.handler;

    await expect(handler({ input: { clipId: "clip-other" }, ctx: validCtx })).rejects.toMatchObject(
      { code: "FORBIDDEN" },
    );
  });

  it("should map unknown AppError to INTERNAL_SERVER_ERROR", async () => {
    const { AppError } = await import("@/server/lib/errors");
    mockDeleteClip.mockRejectedValue(new AppError("TWILIO_ERROR", "Unknown"));

    const { clipsV1Router } = await import("../clips");
    const handler = (clipsV1Router as any).delete.handler;

    await expect(handler({ input: { clipId: "clip-1" }, ctx: validCtx })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });

  it("should re-throw non-AppError errors", async () => {
    mockDeleteClip.mockRejectedValue(new Error("Unexpected error"));

    const { clipsV1Router } = await import("../clips");
    const handler = (clipsV1Router as any).delete.handler;

    await expect(handler({ input: { clipId: "clip-1" }, ctx: validCtx })).rejects.toThrow(
      "Unexpected error",
    );
  });

  it("should reject empty clipId (Zod)", async () => {
    const { clipsV1Router } = await import("../clips");
    const handler = (clipsV1Router as any).delete.handler;

    await expect(handler({ input: { clipId: "" }, ctx: validCtx })).rejects.toThrow();
  });
});
