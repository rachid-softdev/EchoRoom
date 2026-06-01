import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// socialRouter.trackShare tests
// ---------------------------------------------------------------------------
// Tests the trackShare mutation that creates a ShareEvent record.
// Mocks @/server/db and @/server/trpc to capture and test the handler directly.

const mockDb = vi.hoisted(() => ({
  shareEvent: {
    create: vi.fn(),
  },
  scenario: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/server/db", () => ({
  db: mockDb,
}));

// Mock tRPC to capture mutation handlers for direct testing.
vi.mock("@/server/trpc", () => {
  const chain = {
    input: vi.fn(() => chain),
    mutation: vi.fn((handler: Function) => ({
      type: "mutation" as const,
      handler,
    })),
    query: vi.fn(() => ({
      type: "query" as const,
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
    withTracing: vi.fn(() => chain),
    isAuthenticated: chain,
    isAdmin: chain,
  };
});

type TrackShareInput = {
  input: { scenarioId: string; platform: string };
  ctx: { session?: { user?: { id: string } } | null };
};
type MutationHandler = (opts: TrackShareInput) => Promise<{ success: boolean }>;

describe("socialRouter.trackShare", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.scenario.findUnique.mockResolvedValue({ id: "scenario-abc" });
  });

  it("should create a ShareEvent record and return { success: true }", async () => {
    mockDb.shareEvent.create.mockResolvedValue({ id: "share-1" });

    const { socialRouter } = await import("../social");

    // @ts-expect-error — mutation handler is captured at module import time
    const handler: MutationHandler = socialRouter.trackShare.handler;

    const result = await handler({
      input: { scenarioId: "scenario-abc", platform: "TWITTER" },
      ctx: { session: { user: { id: "user-1" } } },
    });

    expect(result).toEqual({ success: true });

    expect(mockDb.shareEvent.create).toHaveBeenCalledTimes(1);
    expect(mockDb.shareEvent.create).toHaveBeenCalledWith({
      data: {
        scenarioId: "scenario-abc",
        platform: "TWITTER",
        userId: "user-1",
      },
    });
  });

  it("should pass the user ID to ShareEvent create", async () => {
    mockDb.shareEvent.create.mockResolvedValue({ id: "share-2" });

    const { socialRouter } = await import("../social");

    // @ts-expect-error — mutation handler is captured at module import time
    const handler: MutationHandler = socialRouter.trackShare.handler;

    await handler({
      input: { scenarioId: "scenario-xyz", platform: "DISCORD" },
      ctx: { session: { user: { id: "user-2" } } },
    });

    expect(mockDb.shareEvent.create).toHaveBeenCalledWith({
      data: {
        scenarioId: "scenario-xyz",
        platform: "DISCORD",
        userId: "user-2",
      },
    });
  });

  it("should verify the scenario exists before creating a share", async () => {
    mockDb.shareEvent.create.mockResolvedValue({ id: "share-3" });

    const { socialRouter } = await import("../social");

    // @ts-expect-error — mutation handler is captured at module import time
    const handler: MutationHandler = socialRouter.trackShare.handler;

    await handler({
      input: { scenarioId: "scenario-xyz", platform: "COPY_LINK" },
      ctx: { session: { user: { id: "user-3" } } },
    });

    expect(mockDb.scenario.findUnique).toHaveBeenCalledWith({
      where: { id: "scenario-xyz" },
      select: { id: true },
    });
  });

  it("should work with WEB_SHARE platform", async () => {
    mockDb.shareEvent.create.mockResolvedValue({ id: "share-4" });

    const { socialRouter } = await import("../social");

    // @ts-expect-error — mutation handler is captured at module import time
    const handler: MutationHandler = socialRouter.trackShare.handler;

    const result = await handler({
      input: { scenarioId: "scenario-123", platform: "WEB_SHARE" },
      ctx: { session: { user: { id: "user-2" } } },
    });

    expect(result).toEqual({ success: true });
    expect(mockDb.shareEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scenarioId: "scenario-123",
          platform: "WEB_SHARE",
        }),
      }),
    );
  });

  it("should work with TIKTOK platform", async () => {
    mockDb.shareEvent.create.mockResolvedValue({ id: "share-5" });

    const { socialRouter } = await import("../social");

    // @ts-expect-error — mutation handler is captured at module import time
    const handler: MutationHandler = socialRouter.trackShare.handler;

    const result = await handler({
      input: { scenarioId: "scenario-456", platform: "TIKTOK" },
      ctx: { session: { user: { id: "user-3" } } },
    });

    expect(result).toEqual({ success: true });
  });

  it("should create ShareEvent with correct scenarioId", async () => {
    mockDb.shareEvent.create.mockResolvedValue({ id: "share-6" });

    const { socialRouter } = await import("../social");

    // @ts-expect-error — mutation handler is captured at module import time
    const handler: MutationHandler = socialRouter.trackShare.handler;

    await handler({
      input: { scenarioId: "specific-scenario-id", platform: "COPY_LINK" },
      ctx: { session: { user: { id: "user-4" } } },
    });

    expect(mockDb.shareEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scenarioId: "specific-scenario-id",
        }),
      }),
    );
  });
});
