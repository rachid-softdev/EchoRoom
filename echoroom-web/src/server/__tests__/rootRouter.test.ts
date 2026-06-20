import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// rootRouter — structure verification
// ---------------------------------------------------------------------------
// The root router composes all sub-routers into a single appRouter.
// Mock dependencies to avoid next-auth / next/server module resolution issues.

vi.mock("@/server/db", () => ({
  db: {},
}));

vi.mock("@/lib/auth", () => ({
  default: vi.fn(),
  auth: vi.fn(),
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

vi.mock("@/server/lib/requestContext", () => ({
  runWithContext: vi.fn((_ctx: any, fn: Function) => fn()),
}));

vi.mock("@/server/middleware/csrf", () => ({
  validateCSRF: vi.fn(),
  CSRFFailure: class CSRFFailure extends Error {},
}));

vi.mock("@/server/middleware/rateLimit", () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock("@/server/services/ai/moderation", () => ({
  checkContentBlocklist: vi.fn(() => ({ approved: true })),
}));

vi.mock("@/server/middleware/ipRateLimit", () => ({
  withIPRateLimit: vi.fn(() => (opts: { next: Function }) => opts.next()),
}));

describe("appRouter — root router structure", () => {
  it("should export appRouter with all unversioned sub-routers", async () => {
    const { appRouter } = await import("../rootRouter");

    expect(appRouter).toBeDefined();
    expect(appRouter).toHaveProperty("auth");
    expect(appRouter).toHaveProperty("characters");
    expect(appRouter).toHaveProperty("scenarios");
    expect(appRouter).toHaveProperty("calls");
    expect(appRouter).toHaveProperty("billing");
    expect(appRouter).toHaveProperty("community");
    expect(appRouter).toHaveProperty("admin");
    expect(appRouter).toHaveProperty("social");
    expect(appRouter).toHaveProperty("clips");
    expect(appRouter).toHaveProperty("profile");
    expect(appRouter).toHaveProperty("user");
    expect(appRouter).toHaveProperty("dashboard");
  });

  it("should include v1 namespace with all versioned sub-routers", async () => {
    const { appRouter } = await import("../rootRouter");

    expect(appRouter).toHaveProperty("v1");
    expect(appRouter.v1).toHaveProperty("scenarios");
    expect(appRouter.v1).toHaveProperty("auth");
    expect(appRouter.v1).toHaveProperty("characters");
    expect(appRouter.v1).toHaveProperty("calls");
    expect(appRouter.v1).toHaveProperty("billing");
    expect(appRouter.v1).toHaveProperty("community");
    expect(appRouter.v1).toHaveProperty("admin");
    expect(appRouter.v1).toHaveProperty("social");
    expect(appRouter.v1).toHaveProperty("clips");
    expect(appRouter.v1).toHaveProperty("profile");
    expect(appRouter.v1).toHaveProperty("user");
    expect(appRouter.v1).toHaveProperty("dashboard");
  });

  it("should have at least 13 keys (12 unversioned + 1 v1 namespace)", async () => {
    const { appRouter } = await import("../rootRouter");
    const keys = Object.keys(appRouter);

    expect(keys).toContain("v1");
    // tRPC router() may add internal _def, createCaller, etc.
    const nonV1Keys = keys.filter((k) => k !== "v1");
    expect(nonV1Keys.length).toBeGreaterThanOrEqual(12);
    // Verify all expected unversioned keys are present
    expect(nonV1Keys).toContain("auth");
    expect(nonV1Keys).toContain("characters");
    expect(nonV1Keys).toContain("scenarios");
    expect(nonV1Keys).toContain("calls");
    expect(nonV1Keys).toContain("billing");
    expect(nonV1Keys).toContain("community");
    expect(nonV1Keys).toContain("admin");
    expect(nonV1Keys).toContain("social");
    expect(nonV1Keys).toContain("clips");
    expect(nonV1Keys).toContain("profile");
    expect(nonV1Keys).toContain("user");
    expect(nonV1Keys).toContain("dashboard");
  });
});
