import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * requireFeature middleware tests.
 *
 * The middleware is a tRPC middleware factory: it throws UNAUTHORIZED without
 * a session, resolves the caller's tier (default: from UserBilling.plan), and
 * throws FORBIDDEN when the flag is disabled for that tier.
 *
 * We mock @/server/trpc so `middleware(fn)` returns the raw callback (tRPC
 * v11's MiddlewareBuilder is not directly callable), and @/server/db so the
 * default tier resolver reads a controllable plan.
 */

const { userBillingFindUnique } = vi.hoisted(() => ({
  userBillingFindUnique: vi.fn(),
}));

vi.mock("@/server/trpc", () => ({
  middleware: (fn: (opts: unknown) => unknown) => fn,
}));

vi.mock("@/server/db", () => ({
  db: { userBilling: { findUnique: userBillingFindUnique } },
}));

describe("requireFeature", () => {
  let requireFeature: typeof import("@/lib/featureFlags").requireFeature;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const mod = await import("@/lib/featureFlags");
    requireFeature = mod.requireFeature;
  });

  afterEach(() => {
    // The config module caches env overrides — keep it clean across tests.
    delete process.env["FEATURE_FLAGS"];
    delete process.env["FF_BETA_API_ACCESS"];
  });

  function createNext() {
    return vi.fn().mockResolvedValue({ ok: true });
  }

  /**
   * Runtime helper: the mocked @/server/trpc returns the raw callback, but the
   * real (typecheck-time) return type of requireFeature is tRPC's
   * MiddlewareBuilder, which has no call signature. Cast through unknown.
   */
  function invoke(
    middlewareFactory: unknown,
    opts: { ctx: unknown; next: () => Promise<unknown> },
  ) {
    return (middlewareFactory as (o: typeof opts) => Promise<unknown>)(opts);
  }

  const authedCtx = { session: { user: { id: "user-1" } } };

  it("throws UNAUTHORIZED when there is no session", async () => {
    const middleware = requireFeature("betaApiAccess");
    const next = createNext();
    await expect(invoke(middleware, { ctx: { session: null }, next })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(invoke(middleware, { ctx: {}, next })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("throws FORBIDDEN when the flag is disabled for the resolved tier", async () => {
    userBillingFindUnique.mockResolvedValue({ plan: "FREE" });
    const middleware = requireFeature("betaApiAccess");
    const next = createNext();
    await expect(invoke(middleware, { ctx: authedCtx, next })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("blocks every sub-ultra tier on an ultra-only flag", async () => {
    const middleware = requireFeature("betaMultiplayerRooms");
    const next = createNext();
    for (const plan of ["FREE", "STARTER", "PRO"]) {
      userBillingFindUnique.mockResolvedValue({ plan });
      await expect(invoke(middleware, { ctx: authedCtx, next })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
    expect(next).not.toHaveBeenCalled();
  });

  it("allows the flag for ultra (highest tier)", async () => {
    userBillingFindUnique.mockResolvedValue({ plan: "ULTRA" });
    const middleware = requireFeature("betaApiAccess");
    const next = createNext();
    await expect(invoke(middleware, { ctx: authedCtx, next })).resolves.toEqual({ ok: true });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("allows a lower-tier flag for every tier that has it", async () => {
    const middleware = requireFeature("newCharacterCategory");
    const next = createNext();
    // newCharacterCategory targets all tiers with a 25% rollout — find a
    // userId whose bucket passes, then assert the gate lets it through.
    let passed = false;
    for (let i = 0; i < 200; i++) {
      userBillingFindUnique.mockResolvedValue({ plan: "FREE" });
      const ctx = { session: { user: { id: `user-${i}` } } };
      try {
        await invoke(middleware, { ctx, next });
        passed = true;
        break;
      } catch (error) {
        if ((error as { code?: string }).code !== "FORBIDDEN") throw error;
      }
    }
    expect(passed).toBe(true);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("defaults to free when the billing row is missing", async () => {
    userBillingFindUnique.mockResolvedValue(null);
    const middleware = requireFeature("betaApiAccess");
    const next = createNext();
    await expect(invoke(middleware, { ctx: authedCtx, next })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("uses a custom tier resolver when provided (and skips the DB)", async () => {
    const middleware = requireFeature("betaApiAccess", async () => "pro");
    const next = createNext();
    await expect(invoke(middleware, { ctx: authedCtx, next })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(userBillingFindUnique).not.toHaveBeenCalled();

    const ultraMiddleware = requireFeature("betaApiAccess", async () => "ultra");
    await expect(invoke(ultraMiddleware, { ctx: authedCtx, next })).resolves.toEqual({ ok: true });
  });

  it("rejects with a French, flag-specific message", async () => {
    userBillingFindUnique.mockResolvedValue({ plan: "FREE" });
    const middleware = requireFeature("betaApiAccess");
    await expect(
      invoke(middleware, { ctx: authedCtx, next: createNext() }),
    ).rejects.toMatchObject({
      message: "La fonctionnalité « betaApiAccess » n'est pas disponible pour votre palier.",
    });
  });
});
