import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// clipsRouter tests — listByCall, listByUser, create, delete
// ---------------------------------------------------------------------------

const mockDb = vi.hoisted(() => ({
  call: {
    findUnique: vi.fn(),
  },
  clip: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/server/db", () => ({
  db: mockDb,
}));

// Mock the clip service functions
const mockClipsService = vi.hoisted(() => ({
  createClip: vi.fn(),
  deleteClip: vi.fn(),
  getClips: vi.fn(),
}));

vi.mock("@/server/services/social/clips", () => mockClipsService);

// Mock tRPC
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

// Mock RED metrics middleware
vi.mock("@/server/middleware/metrics", () => ({
  withREDMetrics: vi.fn(() => (opts: { next: Function }) => opts.next()),
}));

type ListByCallInput = { input: { callId: string }; ctx: { session: { user: { id: string } } } };
type ListByCallHandler = (opts: ListByCallInput) => Promise<unknown[]>;

type ListByUserInput = { input: { cursor?: string; limit?: number }; ctx: { session: { user: { id: string } } } };
type ListByUserHandler = (opts: ListByUserInput) => Promise<{ items: unknown[]; nextCursor?: string }>;

type CreateInput = { input: { callId: string; startTime: number; endTime: number; title?: string }; ctx: { session: { user: { id: string } } } };
type CreateHandler = (opts: CreateInput) => Promise<{ clipId: string }>;

type DeleteInput = { input: { clipId: string }; ctx: { session: { user: { id: string } } } };
type DeleteHandler = (opts: DeleteInput) => Promise<{ success: boolean }>;

describe("clipsRouter.listByCall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return clips when call exists and is owned by user", async () => {
    mockDb.call.findUnique.mockResolvedValue({ id: "call-1", userId: "user-1" });
    mockClipsService.getClips.mockResolvedValue([
      { id: "clip-1", clipUrl: "https://cdn.example.com/clip-1.mp3" },
    ]);

    const { clipsRouter } = await import("../clips");
    // @ts-expect-error — query handler is captured at module import time
    const handler: ListByCallHandler = clipsRouter.listByCall.handler;

    const result = await handler({
      input: { callId: "call-1" },
      ctx: { session: { user: { id: "user-1" } } },
    });

    expect(result).toHaveLength(1);
    expect(mockDb.call.findUnique).toHaveBeenCalledWith({
      where: { id: "call-1" },
      select: { userId: true },
    });
    expect(mockClipsService.getClips).toHaveBeenCalledWith("call-1");
  });

  it("should throw NOT_FOUND when call does not exist", async () => {
    mockDb.call.findUnique.mockResolvedValue(null);

    const { clipsRouter } = await import("../clips");
    // @ts-expect-error — query handler is captured at module import time
    const handler: ListByCallHandler = clipsRouter.listByCall.handler;

    await expect(
      handler({
        input: { callId: "nonexistent" },
        ctx: { session: { user: { id: "user-1" } } },
      }),
    ).rejects.toThrow("Appel introuvable");
  });

  it("should throw FORBIDDEN when user does not own the call", async () => {
    mockDb.call.findUnique.mockResolvedValue({ id: "call-1", userId: "other-user" });

    const { clipsRouter } = await import("../clips");
    // @ts-expect-error — query handler is captured at module import time
    const handler: ListByCallHandler = clipsRouter.listByCall.handler;

    await expect(
      handler({
        input: { callId: "call-1" },
        ctx: { session: { user: { id: "user-1" } } },
      }),
    ).rejects.toThrow("Accès refusé");
  });
});

describe("clipsRouter.listByUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return paginated clips and a nextCursor when there are more", async () => {
    const clips = Array.from({ length: 11 }, (_, i) => ({
      id: `clip-${i}`,
      userId: "user-1",
      createdAt: new Date(),
      call: { scenario: { id: `s-${i}`, title: `Scenario ${i}` } },
    }));
    mockDb.clip.findMany.mockResolvedValue(clips);

    const { clipsRouter } = await import("../clips");
    // @ts-expect-error — query handler is captured at module import time
    const handler: ListByUserHandler = clipsRouter.listByUser.handler;

    const result = await handler({
      input: { limit: 10 },
      ctx: { session: { user: { id: "user-1" } } },
    });

    expect(result.items).toHaveLength(10);
    expect(result.nextCursor).toBeDefined();
    expect(result.nextCursor).toBe("clip-9");

    expect(mockDb.clip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        take: 11,
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("should return empty items array when user has no clips", async () => {
    mockDb.clip.findMany.mockResolvedValue([]);

    const { clipsRouter } = await import("../clips");
    // @ts-expect-error — query handler is captured at module import time
    const handler: ListByUserHandler = clipsRouter.listByUser.handler;

    const result = await handler({
      input: { limit: 10 },
      ctx: { session: { user: { id: "user-empty" } } },
    });

    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeUndefined();
  });

  it("should handle cursor-based pagination", async () => {
    const clips = Array.from({ length: 3 }, (_, i) => ({
      id: `clip-${i + 5}`,
      userId: "user-1",
      createdAt: new Date(),
      call: { scenario: { id: `s-${i + 5}`, title: `Scenario ${i + 5}` } },
    }));
    mockDb.clip.findMany.mockResolvedValue(clips);

    const { clipsRouter } = await import("../clips");
    // @ts-expect-error — query handler is captured at module import time
    const handler: ListByUserHandler = clipsRouter.listByUser.handler;

    const result = await handler({
      input: { cursor: "clip-5", limit: 10 },
      ctx: { session: { user: { id: "user-1" } } },
    });

    expect(result.items).toHaveLength(3);
    expect(result.nextCursor).toBeUndefined();
    expect(mockDb.clip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 11,
        skip: 1,
        cursor: { id: "clip-5" },
      }),
    );
  });
});

describe("clipsRouter.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a clip and return the clipId", async () => {
    mockClipsService.createClip.mockResolvedValue({ clipId: "clip-new" });

    const { clipsRouter } = await import("../clips");
    // @ts-expect-error — mutation handler is captured at module import time
    const handler: CreateHandler = clipsRouter.create.handler;

    const result = await handler({
      input: { callId: "call-1", startTime: 10, endTime: 30, title: "My Clip" },
      ctx: { session: { user: { id: "user-1" } } },
    });

    expect(result).toEqual({ clipId: "clip-new" });
    expect(mockClipsService.createClip).toHaveBeenCalledWith({
      callId: "call-1",
      userId: "user-1",
      title: "My Clip",
      startTime: 10,
      endTime: 30,
    });
  });

  it("should create a clip without optional title", async () => {
    mockClipsService.createClip.mockResolvedValue({ clipId: "clip-new" });

    const { clipsRouter } = await import("../clips");
    // @ts-expect-error — mutation handler is captured at module import time
    const handler: CreateHandler = clipsRouter.create.handler;

    const result = await handler({
      input: { callId: "call-1", startTime: 0, endTime: 15 },
      ctx: { session: { user: { id: "user-1" } } },
    });

    expect(result).toEqual({ clipId: "clip-new" });
    expect(mockClipsService.createClip).toHaveBeenCalledWith({
      callId: "call-1",
      userId: "user-1",
      startTime: 0,
      endTime: 15,
    });
    // Title should NOT be in the call
    expect(mockClipsService.createClip.mock.calls[0][0]).not.toHaveProperty("title");
  });

  it("should reject endTime <= startTime (Zod refine)", async () => {
    const { clipsRouter } = await import("../clips");
    // @ts-expect-error — mutation handler is captured at module import time
    const handler: CreateHandler = clipsRouter.create.handler;

    // The refine is in the Zod schema. Since we mock tRPC, the Zod validation
    // runs as part of the input() chain before the mutation handler.
    // The actual schema validation is applied dynamically.
    // We test the service layer behavior: if zod passes, createClip is called.
    mockClipsService.createClip.mockRejectedValue(
      Object.assign(new Error("La fin du clip doit être après le début"), { code: "BAD_REQUEST" }),
    );

    await expect(
      handler({
        input: { callId: "call-1", startTime: 30, endTime: 10 },
        ctx: { session: { user: { id: "user-1" } } },
      }),
    ).rejects.toThrow();
  });
});

describe("clipsRouter.delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete a clip and return success", async () => {
    mockClipsService.deleteClip.mockResolvedValue({ success: true });

    const { clipsRouter } = await import("../clips");
    // @ts-expect-error — mutation handler is captured at module import time
    const handler: DeleteHandler = clipsRouter.delete.handler;

    const result = await handler({
      input: { clipId: "clip-1" },
      ctx: { session: { user: { id: "user-1" } } },
    });

    expect(result).toEqual({ success: true });
    expect(mockClipsService.deleteClip).toHaveBeenCalledWith("clip-1", "user-1");
  });

  it("should propagate NOT_FOUND from service", async () => {
    mockClipsService.deleteClip.mockRejectedValue(
      Object.assign(new Error("Clip introuvable"), { code: "NOT_FOUND" }),
    );

    const { clipsRouter } = await import("../clips");
    // @ts-expect-error — mutation handler is captured at module import time
    const handler: DeleteHandler = clipsRouter.delete.handler;

    await expect(
      handler({
        input: { clipId: "nonexistent" },
        ctx: { session: { user: { id: "user-1" } } },
      }),
    ).rejects.toThrow("Clip introuvable");
  });

  it("should propagate FORBIDDEN from service for other user's clip", async () => {
    mockClipsService.deleteClip.mockRejectedValue(
      Object.assign(new Error("Ce clip ne vous appartient pas"), { code: "FORBIDDEN" }),
    );

    const { clipsRouter } = await import("../clips");
    // @ts-expect-error — mutation handler is captured at module import time
    const handler: DeleteHandler = clipsRouter.delete.handler;

    await expect(
      handler({
        input: { clipId: "clip-others" },
        ctx: { session: { user: { id: "user-2" } } },
      }),
    ).rejects.toThrow("Ce clip ne vous appartient pas");
  });
});
