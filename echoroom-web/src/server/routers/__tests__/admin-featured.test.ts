import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Admin featured curation tests
// ---------------------------------------------------------------------------

const mockDb = vi.hoisted(() => ({
  scenario: {
    findUnique: vi.fn(),
  },
  featuredScenario: {
    upsert: vi.fn(),
    deleteMany: vi.fn(),
    findUnique: vi.fn(),
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

// ─── featureScenario ───────────────────────────────────────────────────────

describe("adminRouter.featureScenario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.scenario.findUnique.mockResolvedValue({ id: "scenario-1" });
    mockDb.featuredScenario.upsert.mockResolvedValue({ id: "featured-1" });
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });
    mockRedis.del.mockResolvedValue(1);
  });

  it("should upsert featured scenario with today's date", async () => {
    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).featureScenario.handler;

    const result = await handler({
      input: { scenarioId: "scenario-1" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(result).toEqual({ success: true });
    expect(mockDb.featuredScenario.upsert).toHaveBeenCalledTimes(1);
    const upsertCall = mockDb.featuredScenario.upsert.mock.calls[0][0];
    expect(upsertCall.where.featuredDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(upsertCall.update.scenarioId).toBe("scenario-1");
    expect(upsertCall.update.featureType).toBe("ADMIN_CURATED");
    expect(upsertCall.create.scenarioId).toBe("scenario-1");
    expect(upsertCall.create.featureType).toBe("ADMIN_CURATED");
    expect(upsertCall.create.featuredDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("should replace existing featured scenario for today (upsert update)", async () => {
    // Simulate that today already has a featured scenario
    // upsert should update it (replace scenarioId)
    mockDb.featuredScenario.upsert.mockResolvedValue({
      id: "featured-1",
      scenarioId: "scenario-1",
    });

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).featureScenario.handler;

    await handler({
      input: { scenarioId: "scenario-1" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    // upsert called with update containing the new scenarioId
    const upsertCall = mockDb.featuredScenario.upsert.mock.calls[0][0];
    expect(upsertCall.update.scenarioId).toBe("scenario-1");
    expect(upsertCall.create.scenarioId).toBe("scenario-1");
  });

  it("should create audit log entry", async () => {
    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).featureScenario.handler;

    await handler({
      input: { scenarioId: "scenario-1" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(mockDb.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: "FEATURE_SCENARIO",
        entityType: "Scenario",
        entityId: "scenario-1",
        adminId: "admin-1",
      },
    });
  });

  it("should invalidate featured cache", async () => {
    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).featureScenario.handler;

    await handler({
      input: { scenarioId: "scenario-1" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(mockRedis.del).toHaveBeenCalledWith("admin:featuredScenario");
  });

  it("should throw NOT_FOUND when scenario does not exist", async () => {
    mockDb.scenario.findUnique.mockResolvedValue(null);

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).featureScenario.handler;

    await expect(
      handler({
        input: { scenarioId: "nonexistent" },
        ctx: { session: { user: { id: "admin-1" } } },
      }),
    ).rejects.toThrow("Scénario introuvable");

    expect(mockDb.featuredScenario.upsert).not.toHaveBeenCalled();
    expect(mockDb.auditLog.create).not.toHaveBeenCalled();
  });
});

// ─── removeFeatured ────────────────────────────────────────────────────────

describe("adminRouter.removeFeatured", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.featuredScenario.deleteMany.mockResolvedValue({ count: 1 });
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });
    mockRedis.del.mockResolvedValue(1);
  });

  it("should remove featured scenario for today", async () => {
    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).removeFeatured.handler;

    const result = await handler({
      input: { scenarioId: "scenario-1" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(result).toEqual({ success: true });
    expect(mockDb.featuredScenario.deleteMany).toHaveBeenCalledWith({
      where: {
        scenarioId: "scenario-1",
        featuredDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      },
    });
    expect(mockDb.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: "REMOVE_FEATURED",
        entityType: "Scenario",
        entityId: "scenario-1",
        adminId: "admin-1",
      },
    });
  });

  it("should return success when no featured scenario exists (count=0)", async () => {
    mockDb.featuredScenario.deleteMany.mockResolvedValue({ count: 0 });

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).removeFeatured.handler;

    const result = await handler({
      input: { scenarioId: "scenario-nonexistent" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(result).toEqual({ success: true });
    // deleteMany returned 0 but no error is thrown
    expect(mockDb.auditLog.create).toHaveBeenCalled();
  });

  it("should not match when scenario is featured on a different day", async () => {
    // Simulate scenario featured yesterday but not today
    mockDb.featuredScenario.deleteMany.mockResolvedValue({ count: 0 });

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).removeFeatured.handler;

    const result = await handler({
      input: { scenarioId: "scenario-yesterday" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    // deleteMany filtered by today's date, so no match
    expect(result).toEqual({ success: true });
    expect(mockDb.featuredScenario.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          scenarioId: "scenario-yesterday",
          featuredDate: expect.any(String),
        },
      }),
    );
  });

  it("should invalidate featured cache", async () => {
    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).removeFeatured.handler;

    await handler({
      input: { scenarioId: "scenario-1" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(mockRedis.del).toHaveBeenCalledWith("admin:featuredScenario");
  });
});

// ─── getFeaturedScenario ───────────────────────────────────────────────────

describe("adminRouter.getFeaturedScenario", () => {
  const makeFeatured = () => ({
    featuredDate: "2026-06-20",
    scenario: {
      id: "scenario-1",
      title: "Featured Scenario",
      description: "A great scenario",
      playCount: 100,
      likeCount: 10,
      character: { name: "Char", avatarUrl: "/avatar.png" },
      creator: { id: "creator-1", username: "creator" },
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.get.mockReset();
    mockRedis.set.mockReset();
  });

  it("should return null when no featured scenario exists", async () => {
    mockRedis.get.mockResolvedValue(null);
    mockDb.featuredScenario.findUnique.mockResolvedValue(null);

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).getFeaturedScenario.handler;

    const result = await handler({
      input: undefined,
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(result).toBeNull();
  });

  it("should return cached result when cache is hit", async () => {
    const cached = makeFeatured();
    mockRedis.get.mockResolvedValue(JSON.stringify(cached));

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).getFeaturedScenario.handler;

    const result = await handler({
      input: undefined,
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(result).toEqual(cached);
    expect(mockDb.featuredScenario.findUnique).not.toHaveBeenCalled();
  });

  it("should query db and cache result on miss", async () => {
    const featured = makeFeatured();
    mockRedis.get.mockResolvedValue(null);
    mockDb.featuredScenario.findUnique.mockResolvedValue(featured);

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).getFeaturedScenario.handler;

    const result = await handler({
      input: undefined,
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(result).toEqual(featured);
    expect(mockDb.featuredScenario.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { featuredDate: expect.any(String) },
      }),
    );
    expect(mockRedis.set).toHaveBeenCalledWith(
      "admin:featuredScenario",
      JSON.stringify(featured),
      { ex: 30 },
    );
  });

  it("should invalidate cache after featureScenario", async () => {
    mockDb.scenario.findUnique.mockResolvedValue({ id: "scenario-1" });
    mockDb.featuredScenario.upsert.mockResolvedValue({ id: "f-1" });
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).featureScenario.handler;

    await handler({
      input: { scenarioId: "scenario-1" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(mockRedis.del).toHaveBeenCalledWith("admin:featuredScenario");
  });

  it("should invalidate cache after removeFeatured", async () => {
    mockDb.featuredScenario.deleteMany.mockResolvedValue({ count: 1 });
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).removeFeatured.handler;

    await handler({
      input: { scenarioId: "scenario-1" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(mockRedis.del).toHaveBeenCalledWith("admin:featuredScenario");
  });
});
