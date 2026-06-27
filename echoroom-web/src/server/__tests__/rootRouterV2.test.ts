import { describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// appRouterV2 — structure verification
// ---------------------------------------------------------------------------
// The v2 root router composes the same unversioned sub-routers as a frozen
// v2 contract. Mock dependencies to avoid next-auth / next/server issues.

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

describe("appRouterV2 — v2 root router structure", () => {
  it("should export appRouterV2 with all sub-routers", async () => {
    const { appRouterV2 } = await import("../rootRouterV2");

    expect(appRouterV2).toBeDefined();
    expect(appRouterV2).toHaveProperty("auth");
    expect(appRouterV2).toHaveProperty("characters");
    expect(appRouterV2).toHaveProperty("scenarios");
    expect(appRouterV2).toHaveProperty("calls");
    expect(appRouterV2).toHaveProperty("billing");
    expect(appRouterV2).toHaveProperty("community");
    expect(appRouterV2).toHaveProperty("admin");
    expect(appRouterV2).toHaveProperty("social");
    expect(appRouterV2).toHaveProperty("clips");
    expect(appRouterV2).toHaveProperty("profile");
    expect(appRouterV2).toHaveProperty("user");
    expect(appRouterV2).toHaveProperty("dashboard");
  });

  it("should have all sub-routers and no v1 namespace", async () => {
    const { appRouterV2 } = await import("../rootRouterV2");
    const keys = Object.keys(appRouterV2);

    expect(keys).not.toContain("v1");
    // tRPC router() may add internal _def, createCaller, etc.
    expect(keys.length).toBeGreaterThanOrEqual(12);
    // Verify all expected sub-routers are present
    expect(keys).toContain("auth");
    expect(keys).toContain("characters");
    expect(keys).toContain("scenarios");
    expect(keys).toContain("calls");
    expect(keys).toContain("billing");
    expect(keys).toContain("community");
    expect(keys).toContain("admin");
    expect(keys).toContain("social");
    expect(keys).toContain("clips");
    expect(keys).toContain("profile");
    expect(keys).toContain("user");
    expect(keys).toContain("dashboard");
  });
});
