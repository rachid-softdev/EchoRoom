import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Prisma Client Singleton — db tests
// ---------------------------------------------------------------------------
// Tests for db.ts:
//   - db is a PrismaClient instance
//   - Singleton returns same instance across calls
//   - globalForPrisma.prisma is set in non-production
//   - globalForPrisma.prisma is NOT set in production (mocked)

// Track PrismaClient constructor invocations
let prismaConstructorCallCount = 0;
const mockPrismaInstance = {
  $connect: vi.fn(),
  $disconnect: vi.fn(),
};

vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn(() => {
    prismaConstructorCallCount++;
    return mockPrismaInstance;
  }),
}));

describe("db singleton", () => {
  beforeEach(() => {
    // Reset module cache and global state before each test
    vi.resetModules();
    prismaConstructorCallCount = 0;
    delete (globalThis as any).prisma;
    vi.clearAllMocks();
  });

  it("should be a PrismaClient instance", async () => {
    const { db } = await import("../db");
    expect(db).toBeDefined();
    // The mock returns our mockPrismaInstance
    expect(db).toBe(mockPrismaInstance);
  });

  it("should create PrismaClient with log config in non-production", async () => {
    // Save original NODE_ENV and set to development
    const origNodeEnv = (process.env as any).NODE_ENV;
    (process.env as any).NODE_ENV = "development";

    // Clear module cache so the import re-evaluates
    delete (globalThis as any).prisma;
    prismaConstructorCallCount = 0;

    const { PrismaClient } = await import("@prisma/client");
    await import("../db");

    expect(PrismaClient).toHaveBeenCalledTimes(1);
    expect(PrismaClient).toHaveBeenCalledWith(
      expect.objectContaining({
        log: expect.arrayContaining(["error", "warn"]),
      }),
    );

    (process.env as any).NODE_ENV = origNodeEnv;
  });

  it("should create PrismaClient with error-only log in production", async () => {
    const origNodeEnv = (process.env as any).NODE_ENV;
    (process.env as any).NODE_ENV = "production";

    delete (globalThis as any).prisma;
    prismaConstructorCallCount = 0;

    const { PrismaClient } = await import("@prisma/client");
    await import("../db");

    expect(PrismaClient).toHaveBeenCalledTimes(1);
    expect(PrismaClient).toHaveBeenCalledWith(
      expect.objectContaining({
        log: ["error"],
      }),
    );

    (process.env as any).NODE_ENV = origNodeEnv;
  });

  it("should enforce singleton — only one PrismaClient created", async () => {
    // First import creates the instance
    delete (globalThis as any).prisma;
    prismaConstructorCallCount = 0;

    await import("../db");
    expect(prismaConstructorCallCount).toBe(1);

    // Re-import returns cached module — constructor not called again
    await import("../db");
    expect(prismaConstructorCallCount).toBe(1);
  });

  it("should set globalForPrisma.prisma in non-production", async () => {
    const origNodeEnv = (process.env as any).NODE_ENV;
    (process.env as any).NODE_ENV = "development";

    delete (globalThis as any).prisma;
    prismaConstructorCallCount = 0;

    const { db } = await import("../db");
    expect((globalThis as any).prisma).toBe(db);

    (process.env as any).NODE_ENV = origNodeEnv;
  });

  it("should NOT set globalForPrisma.prisma in production", async () => {
    const origNodeEnv = (process.env as any).NODE_ENV;
    (process.env as any).NODE_ENV = "production";

    delete (globalThis as any).prisma;
    prismaConstructorCallCount = 0;

    await import("../db");
    // In production, globalForPrisma.prisma should NOT be set
    // (the if check fails, so no assignment happens)
    expect((globalThis as any).prisma).toBeUndefined();

    (process.env as any).NODE_ENV = origNodeEnv;
  });

  it("should reuse existing globalForPrisma.prisma if already set", async () => {
    const existingInstance = { $connect: vi.fn(), $disconnect: vi.fn() };
    (globalThis as any).prisma = existingInstance;
    prismaConstructorCallCount = 0;

    const { db } = await import("../db");

    // Should reuse existing instance without calling constructor
    expect(db).toBe(existingInstance);
    expect(prismaConstructorCallCount).toBe(0);
  });
});
