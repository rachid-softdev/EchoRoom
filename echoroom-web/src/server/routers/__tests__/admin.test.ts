import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TRPCError } from "@trpc/server";

// ---------------------------------------------------------------------------
// adminRouter tests
// ---------------------------------------------------------------------------
// Tests the admin tRPC router by mocking @/server/trpc and @/server/db.
// The mocked trpc procedures capture mutation handlers so we can call them
// directly with controlled inputs and context.

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

// Mock Redis to avoid real connection attempts during test
vi.mock("@/lib/redis", () => ({
  redis: null,
}));

// Mock the tRPC module so that adminProcedure.input(schema).mutation(handler)
// captures the handler in the router object for direct testing.
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

type FeatureScenarioInput = { input: { scenarioId: string }; ctx: { session: { user: { id: string } } } };
type MutationHandler = (opts: FeatureScenarioInput) => Promise<{ success: boolean }>;

describe("adminRouter.featureScenario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should upsert a featuredScenario with today's date when scenario exists", async () => {
    mockDb.scenario.findUnique.mockResolvedValue({ id: "scenario-abc" });
    mockDb.featuredScenario.upsert.mockResolvedValue({ id: "featured-1" });
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });

    const { adminRouter } = await import("../admin");

    // @ts-expect-error — mutation handler is captured at module import time
    const handler: MutationHandler = adminRouter.featureScenario.handler;

    const result = await handler({
      input: { scenarioId: "scenario-abc" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(result).toEqual({ success: true });

    // Verify scenario lookup
    expect(mockDb.scenario.findUnique).toHaveBeenCalledWith({
      where: { id: "scenario-abc" },
    });

    // Verify upsert was called with correct featuredDate (YYYY-MM-DD format)
    expect(mockDb.featuredScenario.upsert).toHaveBeenCalledTimes(1);
    const upsertCall = mockDb.featuredScenario.upsert.mock.calls[0]![0];

    expect(upsertCall.where).toHaveProperty("featuredDate");
    expect(upsertCall.where.featuredDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(upsertCall.update).toHaveProperty("scenarioId", "scenario-abc");
    expect(upsertCall.update).toHaveProperty("featureType", "ADMIN_CURATED");
    expect(upsertCall.create).toHaveProperty("scenarioId", "scenario-abc");
    expect(upsertCall.create).toHaveProperty("featuredDate");
    expect(upsertCall.create.featuredDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(upsertCall.create).toHaveProperty("featureType", "ADMIN_CURATED");

    // Verify audit log
    expect(mockDb.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: "FEATURE_SCENARIO",
        entityType: "Scenario",
        entityId: "scenario-abc",
        adminId: "admin-1",
      },
    });
  });

  it("should throw NOT_FOUND when scenario does not exist", async () => {
    mockDb.scenario.findUnique.mockResolvedValue(null);

    const { adminRouter } = await import("../admin");

    // @ts-expect-error — mutation handler is captured at module import time
    const handler: MutationHandler = adminRouter.featureScenario.handler;

    await expect(
      handler({
        input: { scenarioId: "nonexistent" },
        ctx: { session: { user: { id: "admin-1" } } },
      }),
    ).rejects.toThrow("Scénario introuvable");

    // Verify no upsert or audit log was attempted
    expect(mockDb.featuredScenario.upsert).not.toHaveBeenCalled();
    expect(mockDb.auditLog.create).not.toHaveBeenCalled();
  });

  it("should throw an error with TRPCError code NOT_FOUND", async () => {
    mockDb.scenario.findUnique.mockResolvedValue(null);

    const { adminRouter } = await import("../admin");

    // @ts-expect-error — mutation handler is captured at module import time
    const handler: MutationHandler = adminRouter.featureScenario.handler;

    try {
      await handler({
        input: { scenarioId: "missing" },
        ctx: { session: { user: { id: "admin-1" } } },
      });
      // Should not reach here
      expect.unreachable("Expected error to be thrown");
    } catch (error) {
      const trpcError = error as TRPCError;
      expect(trpcError.code).toBe("NOT_FOUND");
    }
  });

  it("should use today's date in YYYY-MM-DD format for featuredDate", async () => {
    mockDb.scenario.findUnique.mockResolvedValue({ id: "scenario-abc" });
    mockDb.featuredScenario.upsert.mockResolvedValue({ id: "featured-1" });
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });

    const { adminRouter } = await import("../admin");

    // @ts-expect-error — mutation handler is captured at module import time
    const handler: MutationHandler = adminRouter.featureScenario.handler;

    await handler({
      input: { scenarioId: "scenario-abc" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    const upsertCall = mockDb.featuredScenario.upsert.mock.calls[0]![0];

    // Verify the date matches current UTC date
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const day = String(now.getUTCDate()).padStart(2, "0");
    const expectedDate = `${year}-${month}-${day}`;

    expect(upsertCall.where.featuredDate).toBe(expectedDate);
    expect(upsertCall.create.featuredDate).toBe(expectedDate);
  });

  it("should set featuredAt to a Date object", async () => {
    mockDb.scenario.findUnique.mockResolvedValue({ id: "scenario-abc" });
    mockDb.featuredScenario.upsert.mockResolvedValue({ id: "featured-1" });
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });

    const { adminRouter } = await import("../admin");

    // @ts-expect-error — mutation handler is captured at module import time
    const handler: MutationHandler = adminRouter.featureScenario.handler;

    await handler({
      input: { scenarioId: "scenario-abc" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    const upsertCall = mockDb.featuredScenario.upsert.mock.calls[0]![0];

    expect(upsertCall.update.featuredAt).toBeInstanceOf(Date);
    expect(upsertCall.create.featuredAt).toBeInstanceOf(Date);
  });
});
