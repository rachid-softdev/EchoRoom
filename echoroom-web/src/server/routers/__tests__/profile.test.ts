import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

// ---------------------------------------------------------------------------
// profileRouter — Tests for profile.ts (me, updateProfile, exportData, deleteMyAccount)
// ---------------------------------------------------------------------------

// Mock db
vi.mock("@/server/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    userProfile: { upsert: vi.fn() },
    scenario: { findMany: vi.fn() },
    call: { findMany: vi.fn() },
    comment: { findMany: vi.fn() },
    purchase: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

// Mock bcryptjs
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2b$12$mocked_bcrypt_hash"),
    compare: vi.fn(),
  },
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock("@/server/services/user/anonymization", () => ({
  anonymizePersonalData: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/lib/encryption", () => ({
  decryptPhoneNumber: vi.fn((phone: string) => phone),
  maskPhoneNumber: vi.fn((phone: string) => {
    if (phone.length < 6) return "******";
    return phone.slice(0, 3) + "****" + phone.slice(-4);
  }),
}));

// Mock tRPC to capture both query and mutation handler functions
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
    withTracing: vi.fn(() => chain),
    isAuthenticated: chain,
    isAdmin: chain,
  };
});

// ---------------------------------------------------------------------------
// Helper: updateProfile input schema (replicated from profile.ts)
// ---------------------------------------------------------------------------
const updateProfileSchema = z.object({
  username: z.string().min(3).max(30),
});

// ---------------------------------------------------------------------------
// me — profile query
// ---------------------------------------------------------------------------
describe("me — current user profile query", () => {
  let mockDb: any;
  let handler: Function;
  const validCtx = {
    session: { user: { id: "user-123" } },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const dbModule = await import("@/server/db");
    mockDb = dbModule.db;

    const { profileRouter } = await import("../profile");
    // @ts-expect-error — handler captured at import time via tRPC mock
    handler = profileRouter.me.handler;
  });

  it("should return profile with billing credits", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: "user-123",
      email: "test@example.com",
      username: "testuser",
      role: "USER",
      image: "https://example.com/avatar.png",
      credits: 10, // legacy field
      billing: { credits: 100 }, // sub-aggregate (preferred)
    });

    const result = await handler({ ctx: validCtx });

    expect(result.id).toBe("user-123");
    expect(result.email).toBe("test@example.com");
    expect(result.credits).toBe(100); // billing.credits takes precedence
    expect(mockDb.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-123" },
      select: expect.objectContaining({
        billing: { select: { credits: true } },
      }),
    });
  });

  it("should fall back to legacy credits when billing is null", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: "user-123",
      email: "test@example.com",
      username: "testuser",
      role: "USER",
      image: null,
      credits: 50,
      billing: null,
    });

    const result = await handler({ ctx: validCtx });

    expect(result.credits).toBe(50);
  });

  it("should handle null-safe fields correctly (image can be null)", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: "user-123",
      email: "test@example.com",
      username: "testuser",
      role: "USER",
      image: null,
      credits: null,
      billing: null,
    });

    const result = await handler({ ctx: validCtx });

    expect(result.image).toBeNull();
    expect(result.credits).toBeNull(); // both billing and legacy are null
  });

  it("should throw NOT_FOUND when user does not exist (deleted or never created)", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);

    await expect(
      handler({ ctx: validCtx }),
    ).rejects.toThrow(TRPCError);

    try {
      await handler({ ctx: validCtx });
    } catch (e: unknown) {
      expect((e as { code: string }).code).toBe("NOT_FOUND");
      expect((e as { message: string }).message).toContain("introuvable");
    }
  });
});

// ---------------------------------------------------------------------------
// updateProfile — username mutation
// ---------------------------------------------------------------------------
describe("updateProfile — username update", () => {
  let mockDb: any;
  let handler: Function;
  const validCtx = {
    session: { user: { id: "user-123" } },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const dbModule = await import("@/server/db");
    mockDb = dbModule.db;

    const { profileRouter } = await import("../profile");
    // @ts-expect-error
    handler = profileRouter.updateProfile.handler;
  });

  it("should update username and upsert displayName", async () => {
    mockDb.$transaction.mockImplementation(
      async (cb: (tx: any) => Promise<unknown>) => {
        const mockTx = {
          user: { update: vi.fn().mockResolvedValue({}) },
          userProfile: { upsert: vi.fn().mockResolvedValue({}) },
        };
        await cb(mockTx);
        return { success: true };
      },
    );

    const result = await handler({
      input: { username: "newname" },
      ctx: validCtx,
    });

    expect(result).toEqual({ success: true });

    // Verify the transaction received the correct callbacks
    const txCallback = mockDb.$transaction.mock.calls[0]![0];
    const mockTx = {
      user: { update: vi.fn() },
      userProfile: { upsert: vi.fn() },
    };
    await txCallback(mockTx);

    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: "user-123" },
      data: { username: "newname" },
    });
    expect(mockTx.userProfile.upsert).toHaveBeenCalledWith({
      where: { userId: "user-123" },
      create: { userId: "user-123", displayName: "newname" },
      update: { displayName: "newname" },
    });
  });

  it("should reject username shorter than 3 characters (Zod)", () => {
    const result = updateProfileSchema.safeParse({ username: "ab" });
    expect(result.success).toBe(false);
  });

  it("should reject username longer than 30 characters (Zod)", () => {
    const result = updateProfileSchema.safeParse({ username: "a".repeat(31) });
    expect(result.success).toBe(false);
  });

  it("should accept valid username at boundary (3 chars)", () => {
    const result = updateProfileSchema.safeParse({ username: "abc" });
    expect(result.success).toBe(true);
  });

  it("should accept valid username at boundary (30 chars)", () => {
    const result = updateProfileSchema.safeParse({ username: "a".repeat(30) });
    expect(result.success).toBe(true);
  });

  it("should propagate error when user.update fails inside transaction", async () => {
    mockDb.$transaction.mockImplementation(
      async (cb: (tx: any) => Promise<unknown>) => {
        const mockTx = {
          user: {
            update: vi.fn().mockRejectedValue(new Error("Prisma error")),
          },
          userProfile: { upsert: vi.fn() },
        };
        await cb(mockTx);
        return { success: true };
      },
    );

    await expect(
      handler({ input: { username: "newname" }, ctx: validCtx }),
    ).rejects.toThrow("Prisma error");
  });
});

// ---------------------------------------------------------------------------
// exportData — GDPR data portability
// ---------------------------------------------------------------------------
describe("exportData — GDPR data portability", () => {
  let mockDb: any;
  let handler: Function;
  const validCtx = {
    session: { user: { id: "user-123" } },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const dbModule = await import("@/server/db");
    mockDb = dbModule.db;

    const { profileRouter } = await import("../profile");
    // @ts-expect-error
    handler = profileRouter.exportData.handler;
  });

  const baseUser = {
    id: "user-123",
    email: "test@example.com",
    username: "testuser",
    role: "USER",
    image: "https://example.com/avatar.png",
    displayName: "Test User",
    bio: "Hello world",
    credits: 50,
    totalLikesReceived: 42,
    totalCallsMade: 10,
    consentAcceptedAt: new Date("2026-01-01"),
    gdprDataExportedAt: null,
    deletedAt: null,
    anonymizedAt: null,
    createdAt: new Date("2026-01-01"),
    profile: { image: "https://example.com/avatar.png", displayName: "Test User", bio: "Hello world" },
    social: { totalLikesReceived: 42, totalCallsMade: 10 },
    billing: { credits: 50 },
  };

  it("should return complete export with all sections", async () => {
    mockDb.user.findUnique.mockResolvedValue(baseUser);
    mockDb.scenario.findMany.mockResolvedValue([
      { id: "sc-1", title: "My Scenario", description: "Desc", visibility: "PUBLIC", moderationStatus: "APPROVED", playCount: 100, likeCount: 20, createdAt: new Date(), character: { name: "Char" } },
    ]);
    mockDb.call.findMany.mockResolvedValue([
      { id: "call-1", phoneNumber: "+33612345678", status: "COMPLETED", durationSeconds: 120, costCredits: 5, createdAt: new Date(), endedAt: new Date() },
    ]);
    mockDb.comment.findMany.mockResolvedValue([
      { id: "cmt-1", content: "Nice scenario!", moderationStatus: "APPROVED", createdAt: new Date(), scenario: { id: "sc-1", title: "My Scenario" } },
    ]);
    mockDb.purchase.findMany.mockResolvedValue([
      { id: "pch-1", creditsPurchased: 100, createdAt: new Date() },
    ]);

    const result = await handler({ input: {}, ctx: validCtx });

    expect(result.exportedAt).toBeDefined();
    expect(result.user).toBeDefined();
    expect(result.scenarios).toHaveLength(1);
    expect(result.calls).toHaveLength(1);
    expect(result.comments).toHaveLength(1);
    expect(result.purchases).toHaveLength(1);
    expect(result.scenarios[0].title).toBe("My Scenario");
    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: "user-123" },
      data: { gdprDataExportedAt: expect.any(Date) },
    });
  });

  it("should return empty arrays for fresh user (no data yet)", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      ...baseUser,
      profile: null,
      social: null,
      billing: null,
    });
    mockDb.scenario.findMany.mockResolvedValue([]);
    mockDb.call.findMany.mockResolvedValue([]);
    mockDb.comment.findMany.mockResolvedValue([]);
    mockDb.purchase.findMany.mockResolvedValue([]);

    const result = await handler({ input: {}, ctx: validCtx });

    expect(result.scenarios).toEqual([]);
    expect(result.calls).toEqual([]);
    expect(result.comments).toEqual([]);
    expect(result.purchases).toEqual([]);
  });

  it("should fallback mask phone number when decryption fails", async () => {
    mockDb.user.findUnique.mockResolvedValue(baseUser);
    mockDb.scenario.findMany.mockResolvedValue([]);
    mockDb.call.findMany.mockResolvedValue([
      { id: "call-1", phoneNumber: "1234", status: "COMPLETED", durationSeconds: 60, costCredits: 3, createdAt: new Date(), endedAt: null },
    ]);
    mockDb.comment.findMany.mockResolvedValue([]);
    mockDb.purchase.findMany.mockResolvedValue([]);

    // Make decryptPhoneNumber throw
    const { decryptPhoneNumber } = await import("@/server/lib/encryption");
    (decryptPhoneNumber as any).mockImplementation(() => {
      throw new Error("Decryption failed");
    });

    const result = await handler({ input: {}, ctx: validCtx });

    // Fallback: xxxx + last 4 chars ("1234" → "xxxx1234")
    expect(result.calls[0].phoneNumber).toBe("xxxx1234");
  });

  it("should allow export after previous export (double export)", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      ...baseUser,
      gdprDataExportedAt: new Date("2026-05-01"),
    });
    mockDb.scenario.findMany.mockResolvedValue([]);
    mockDb.call.findMany.mockResolvedValue([]);
    mockDb.comment.findMany.mockResolvedValue([]);
    mockDb.purchase.findMany.mockResolvedValue([]);

    const result = await handler({ input: {}, ctx: validCtx });

    expect(result.user.gdprDataExportedAt).toBeInstanceOf(Date);
    // gdprDataExportedAt should be updated
    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: "user-123" },
      data: { gdprDataExportedAt: expect.any(Date) },
    });
  });

  it("should throw NOT_FOUND when user does not exist", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);

    await expect(
      handler({ input: {}, ctx: validCtx }),
    ).rejects.toThrow(TRPCError);

    try {
      await handler({ input: {}, ctx: validCtx });
    } catch (e: unknown) {
      expect((e as { code: string }).code).toBe("NOT_FOUND");
    }
  });
});

// ---------------------------------------------------------------------------
// deleteMyAccount — GDPR account deletion (additional tests)
// ---------------------------------------------------------------------------
describe("deleteMyAccount — GDPR account deletion (additional)", () => {
  let mockDb: any;
  let handler: Function;
  const validCtx = {
    session: { user: { id: "user-123" } },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const dbModule = await import("@/server/db");
    mockDb = dbModule.db;

    const { profileRouter } = await import("../profile");
    // @ts-expect-error
    handler = profileRouter.deleteMyAccount.handler;

    // Default: $transaction executes callback with mockTx
    mockDb.$transaction.mockImplementation(
      async (cb: (tx: any) => Promise<unknown>) => {
        const mockTx = {
          user: { update: vi.fn().mockResolvedValue({}) },
          scenario: { updateMany: vi.fn() },
          comment: { updateMany: vi.fn() },
          call: { updateMany: vi.fn() },
        };
        await cb(mockTx);
        return { success: true };
      },
    );
  });

  it("should be idempotent (double delete succeeds)", async () => {
    const result1 = await handler({
      input: { confirmation: "SUPPRIMER" },
      ctx: validCtx,
    });
    expect(result1).toEqual({ success: true });

    // Second call — $transaction mock is still active and no guard exists
    // against already-deleted users
    const result2 = await handler({
      input: { confirmation: "SUPPRIMER" },
      ctx: validCtx,
    });
    expect(result2).toEqual({ success: true });
  });

  it("should rollback when anonymizePersonalData fails inside transaction", async () => {
    const { anonymizePersonalData } = await import("@/server/services/user/anonymization");
    (anonymizePersonalData as any).mockRejectedValueOnce(new Error("Anonymization failed"));

    mockDb.$transaction.mockImplementation(
      async (cb: (tx: any) => Promise<unknown>) => {
        const mockTx = {
          user: { update: vi.fn().mockResolvedValue({}) },
          scenario: { updateMany: vi.fn() },
          comment: { updateMany: vi.fn() },
          call: { updateMany: vi.fn() },
        };
        await cb(mockTx);
        return { success: true };
      },
    );

    await expect(
      handler({ input: { confirmation: "SUPPRIMER" }, ctx: validCtx }),
    ).rejects.toThrow("Anonymization failed");
  });

  it("should not block deletion when user has active calls (unlike withdrawConsent)", async () => {
    // deleteMyAccount does NOT check for active calls
    // The deletion should proceed regardless
    const result = await handler({
      input: { confirmation: "SUPPRIMER" },
      ctx: validCtx,
    });

    expect(result).toEqual({ success: true });
    // Verify the transaction was called
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
  });

  it("should generate anonymized username in correct format", async () => {
    mockDb.$transaction.mockImplementation(
      async (cb: (tx: any) => Promise<unknown>) => {
        const mockTx = {
          user: { update: vi.fn().mockResolvedValue({}) },
        };
        await cb(mockTx);
        return { success: true };
      },
    );

    await handler({
      input: { confirmation: "SUPPRIMER" },
      ctx: validCtx,
    });

    const txCallback = mockDb.$transaction.mock.calls[0]![0];
    const mockTx = {
      user: { update: vi.fn() },
    };
    await txCallback(mockTx);

    const updateCall = mockTx.user.update.mock.calls[0]![0];
    expect(updateCall.data.username).toMatch(/^utilisateur-[0-9a-f]{8}$/);
    expect(updateCall.data.email).toMatch(/^deleted-[0-9a-f-]+@anonymized\.echoroom\.app$/);
  });
});
