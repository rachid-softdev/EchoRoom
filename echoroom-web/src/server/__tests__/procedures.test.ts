import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// tRPC Procedure Builders — procedures.ts tests
// ---------------------------------------------------------------------------
// Tests for procedures.ts:
//   - publicProcedure chains withTracing and withREDMetrics
//   - protectedProcedure chains withTracing, withREDMetrics, isAuthenticated
//   - adminProcedure chains withTracing, withREDMetrics, isAuthenticated, isAdmin
//   - Re-exports everything from ./trpc

// Tracks middleware passed to each .use() call on t.procedure
// Each procedure chain is captured separately.
const procedureChains: { name: string; middlewares: string[] }[] = [];

// Symbol references for identifying which middleware was used
const WITH_TRACING = "WITH_TRACING" as const;
const WITH_RED_METRICS = "WITH_RED_METRICS" as const;
const IS_AUTHENTICATED = "IS_AUTHENTICATED" as const;
const IS_ADMIN = "IS_ADMIN" as const;

// chainIndex is module-level so beforeEach can reset it alongside procedureChains
let chainIndex = 0;

vi.mock("@/server/trpc", () => {
  return {
    t: {
      procedure: {
        use: vi.fn((mw: string) => {
          const currentIndex = chainIndex++;
          const names = ["publicProcedure", "protectedProcedure", "adminProcedure"];
          procedureChains.push({ name: names[currentIndex] ?? `chain-${currentIndex}`, middlewares: [mw] });

          return {
            use: (mw2: string) => {
              procedureChains[currentIndex]?.middlewares.push(mw2);
              return {
                use: (mw3: string) => {
                  procedureChains[currentIndex]?.middlewares.push(mw3);
                  return {
                    use: (mw4: string) => {
                      procedureChains[currentIndex]?.middlewares.push(mw4);
                      return {};
                    },
                  };
                },
              };
            },
          };
        }),
      },
    },
    withTracing: WITH_TRACING,
    isAuthenticated: IS_AUTHENTICATED,
    isAdmin: IS_ADMIN,
    // Re-exports from ./trpc
    createTRPCContext: "re-exported:createTRPCContext",
    TRPCContext: {} as any,
    AuthenticatedSession: {} as any,
    AdminSession: {} as any,
    AuthenticatedTRPCContext: {} as any,
    AdminTRPCContext: {} as any,
    router: "re-exported:router",
    mergeRouters: "re-exported:mergeRouters",
    middleware: "re-exported:middleware",
    withRateLimit: "re-exported:withRateLimit",
    withContentModeration: "re-exported:withContentModeration",
    withVersioning: "re-exported:withVersioning",
    publicProcedure: {},
    protectedProcedure: {},
    adminProcedure: {},
    withIPRateLimit: "re-exported:withIPRateLimit",
    extractTextFromInput: "re-exported:extractTextFromInput",
  };
});

vi.mock("@/server/middleware/metrics", () => ({
  withREDMetrics: WITH_RED_METRICS,
}));

describe("procedure builders", () => {
  beforeEach(() => {
    procedureChains.length = 0;
    chainIndex = 0;
    vi.resetModules();
  });

  it("should export publicProcedure, protectedProcedure, adminProcedure", async () => {
    const mod = await import("../procedures");
    expect(mod.publicProcedure).toBeDefined();
    expect(mod.protectedProcedure).toBeDefined();
    expect(mod.adminProcedure).toBeDefined();
  });

  it("publicProcedure should chain withTracing then withREDMetrics", async () => {
    await import("../procedures");
    const pub = procedureChains.find((c) => c.name === "publicProcedure");
    expect(pub).toBeDefined();
    expect(pub!.middlewares).toHaveLength(2);
    expect(pub!.middlewares[0]).toBe(WITH_TRACING);
    expect(pub!.middlewares[1]).toBe(WITH_RED_METRICS);
  });

  it("protectedProcedure should chain withTracing, withREDMetrics, isAuthenticated", async () => {
    await import("../procedures");
    const prot = procedureChains.find((c) => c.name === "protectedProcedure");
    expect(prot).toBeDefined();
    expect(prot!.middlewares).toHaveLength(3);
    expect(prot!.middlewares[0]).toBe(WITH_TRACING);
    expect(prot!.middlewares[1]).toBe(WITH_RED_METRICS);
    expect(prot!.middlewares[2]).toBe(IS_AUTHENTICATED);
  });

  it("adminProcedure should chain withTracing, withREDMetrics, isAuthenticated, isAdmin", async () => {
    await import("../procedures");
    const admin = procedureChains.find((c) => c.name === "adminProcedure");
    expect(admin).toBeDefined();
    expect(admin!.middlewares).toHaveLength(4);
    expect(admin!.middlewares[0]).toBe(WITH_TRACING);
    expect(admin!.middlewares[1]).toBe(WITH_RED_METRICS);
    expect(admin!.middlewares[2]).toBe(IS_AUTHENTICATED);
    expect(admin!.middlewares[3]).toBe(IS_ADMIN);
  });

  it("should maintain correct middleware order for all procedures", async () => {
    await import("../procedures");

    const pub = procedureChains.find((c) => c.name === "publicProcedure");
    const prot = procedureChains.find((c) => c.name === "protectedProcedure");
    const admin = procedureChains.find((c) => c.name === "adminProcedure");

    // All procedures start with tracing + metrics
    expect(pub!.middlewares[0]).toBe(WITH_TRACING);
    expect(pub!.middlewares[1]).toBe(WITH_RED_METRICS);

    // Protected adds isAuthenticated after metrics
    expect(prot!.middlewares[0]).toBe(WITH_TRACING);
    expect(prot!.middlewares[1]).toBe(WITH_RED_METRICS);
    expect(prot!.middlewares[2]).toBe(IS_AUTHENTICATED);

    // Admin adds isAuthenticated then isAdmin after metrics
    expect(admin!.middlewares[0]).toBe(WITH_TRACING);
    expect(admin!.middlewares[1]).toBe(WITH_RED_METRICS);
    expect(admin!.middlewares[2]).toBe(IS_AUTHENTICATED);
    expect(admin!.middlewares[3]).toBe(IS_ADMIN);
  });
});

describe("re-exports from ./trpc", () => {
  it("should re-export createTRPCContext", async () => {
    const mod = await import("../procedures");
    expect(mod.createTRPCContext).toBe("re-exported:createTRPCContext");
  });

  it("should re-export router", async () => {
    const mod = await import("../procedures");
    expect(mod.router).toBe("re-exported:router");
  });

  it("should re-export mergeRouters", async () => {
    const mod = await import("../procedures");
    expect(mod.mergeRouters).toBe("re-exported:mergeRouters");
  });

  it("should re-export middleware", async () => {
    const mod = await import("../procedures");
    expect(mod.middleware).toBe("re-exported:middleware");
  });

  it("should re-export isAuthenticated", async () => {
    const mod = await import("../procedures");
    expect(mod.isAuthenticated).toBe(IS_AUTHENTICATED);
  });

  it("should re-export isAdmin", async () => {
    const mod = await import("../procedures");
    expect(mod.isAdmin).toBe(IS_ADMIN);
  });

  it("should re-export withTracing", async () => {
    const mod = await import("../procedures");
    expect(mod.withTracing).toBe(WITH_TRACING);
  });

  it("should re-export withRateLimit", async () => {
    const mod = await import("../procedures");
    expect(mod.withRateLimit).toBe("re-exported:withRateLimit");
  });

  it("should re-export withContentModeration", async () => {
    const mod = await import("../procedures");
    expect(mod.withContentModeration).toBe("re-exported:withContentModeration");
  });

  it("should re-export withVersioning", async () => {
    const mod = await import("../procedures");
    expect(mod.withVersioning).toBe("re-exported:withVersioning");
  });

  it("should re-export withIPRateLimit", async () => {
    const mod = await import("../procedures");
    expect(mod.withIPRateLimit).toBe("re-exported:withIPRateLimit");
  });

  it("should re-export extractTextFromInput", async () => {
    const mod = await import("../procedures");
    expect(mod.extractTextFromInput).toBe("re-exported:extractTextFromInput");
  });
});
