import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Admin Security Tests — N2 tokenVersion on delete
// ---------------------------------------------------------------------------
// Verifies that tokenVersion: { increment: 1 } is included in user.update
// calls inside $transaction for:
//   - adminRouter.deleteUser (admin.ts)
//   - profileRouter.deleteMyAccount (profile.ts)
//   - userRouter.withdrawConsent (user.ts) — regression test

const mockDb = vi.hoisted(() => {
  const mockTx = {
    user: {
      findUnique: vi.fn().mockResolvedValue({ consentWithdrawnAt: null }),
      update: vi.fn().mockResolvedValue({ id: "user-1" }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    scenario: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    comment: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    call: {
      findFirst: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "log-1" }) },
  };

  return {
    $transaction: vi.fn(async (cb: Function) => cb(mockTx)),
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    call: {
      findFirst: vi.fn(),
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "log-1" }) },
    // Expose mockTx for assertions
    _mockTx: mockTx,
  };
});

vi.mock("@/server/db", () => ({
  db: mockDb,
}));

vi.mock("@/server/services/user/anonymization", () => ({
  anonymizePersonalData: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/services/telephony/callLifecycle", () => ({
  initiateCall: vi.fn(),
}));

// Mock bcrypt to avoid expensive hashing
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2b$12$mocked_hash_value"),
  },
  hash: vi.fn().mockResolvedValue("$2b$12$mocked_hash_value"),
}));

// Mock encryption utilities
vi.mock("@/server/lib/encryption", () => ({
  maskPhoneNumber: vi.fn((phone: string) => phone),
}));

// Mock tRPC to capture mutation handlers for direct testing
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

describe("adminRouter.deleteUser — N2 tokenVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: user exists and is not deleted (updateMany returns count=1)
    mockDb._mockTx.user.updateMany.mockResolvedValue({ count: 1 });
  });

  it("should include tokenVersion: { increment: 1 } in user.update", async () => {
    const { adminRouter } = await import("../admin");

    // @ts-expect-error — mutation handler captured at import time
    const handler = adminRouter.deleteUser.handler;

    await handler({
      input: { userId: "user-1" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    // Verify $transaction was called
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);

    // Verify user.updateMany was called with tokenVersion increment
    const updateManyCalls = mockDb._mockTx.user.updateMany.mock.calls;
    expect(updateManyCalls.length).toBeGreaterThanOrEqual(1);

    // Check the data passed to updateMany
    const callData = updateManyCalls[0][0];
    expect(callData.where).toEqual({ id: "user-1", deletedAt: null });
    expect(callData.data.tokenVersion).toEqual({ increment: 1 });
  });

  it("should include other deletion fields alongside tokenVersion", async () => {
    const { adminRouter } = await import("../admin");

    // @ts-expect-error — mutation handler captured at import time
    const handler = adminRouter.deleteUser.handler;

    await handler({
      input: { userId: "user-1" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    const updateManyCalls = mockDb._mockTx.user.updateMany.mock.calls;
    expect(updateManyCalls.length).toBeGreaterThanOrEqual(1);

    const data = updateManyCalls[0][0].data;
    expect(data).toHaveProperty("deletedAt");
    expect(data).toHaveProperty("anonymizedAt");
    expect(data).toHaveProperty("email");
    expect(data).toHaveProperty("username");
    expect(data).toHaveProperty("passwordHash");
    expect(data).toHaveProperty("displayName", null);
    expect(data).toHaveProperty("bio", null);
    expect(data).toHaveProperty("image", null);
    expect(data).toHaveProperty("tokenVersion");
  });

  it("should call anonymizePersonalData inside the transaction", async () => {
    const { anonymizePersonalData } = await import(
      "@/server/services/user/anonymization"
    );
    const { adminRouter } = await import("../admin");

    // @ts-expect-error — mutation handler captured at import time
    const handler = adminRouter.deleteUser.handler;

    await handler({
      input: { userId: "user-1" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(anonymizePersonalData).toHaveBeenCalledWith(
      mockDb._mockTx,
      "user-1",
    );
  });

  it("should throw CONFLICT when user does not exist or is already deleted", async () => {
    // updateMany returns count=0 to simulate user not found or already deleted
    mockDb._mockTx.user.updateMany.mockResolvedValue({ count: 0 });

    const { adminRouter } = await import("../admin");

    // @ts-expect-error — mutation handler captured at import time
    const handler = adminRouter.deleteUser.handler;

    await expect(
      handler({
        input: { userId: "nonexistent" },
        ctx: { session: { user: { id: "admin-1" } } },
      }),
    ).rejects.toThrow("Utilisateur introuvable ou déjà supprimé");

    // Transaction was called (updateMany runs inside it)
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("profileRouter.deleteMyAccount — N2 tokenVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should include tokenVersion: { increment: 1 } in user.update", async () => {
    const { profileRouter } = await import("../profile");

    // @ts-expect-error — mutation handler captured at import time
    const handler = profileRouter.deleteMyAccount.handler;

    await handler({
      input: { confirmation: "SUPPRIMER" },
      ctx: { session: { user: { id: "user-1" } } },
    });

    // Verify $transaction was called
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);

    // Verify user.update was called with tokenVersion increment
    const updateCalls = mockDb._mockTx.user.update.mock.calls;
    expect(updateCalls.length).toBeGreaterThanOrEqual(1);

    const tokenVersionCall = updateCalls.find(
      (call: any[]) => call[0]?.data?.tokenVersion,
    );
    expect(tokenVersionCall).toBeDefined();
    expect(tokenVersionCall[0].data.tokenVersion).toEqual({ increment: 1 });
  });

  it("should include all deletion fields alongside tokenVersion", async () => {
    const { profileRouter } = await import("../profile");

    // @ts-expect-error — mutation handler captured at import time
    const handler = profileRouter.deleteMyAccount.handler;

    await handler({
      input: { confirmation: "SUPPRIMER" },
      ctx: { session: { user: { id: "user-1" } } },
    });

    const updateCalls = mockDb._mockTx.user.update.mock.calls;
    const tokenVersionCall = updateCalls.find(
      (call: any[]) => call[0]?.data?.tokenVersion,
    );
    expect(tokenVersionCall).toBeDefined();

    const data = tokenVersionCall[0].data;
    expect(data).toHaveProperty("deletedAt");
    expect(data).toHaveProperty("anonymizedAt");
    expect(data).toHaveProperty("email");
    expect(data).toHaveProperty("username");
    expect(data).toHaveProperty("passwordHash");
    expect(data).toHaveProperty("displayName", null);
    expect(data).toHaveProperty("bio", null);
    expect(data).toHaveProperty("image", null);
    expect(data).toHaveProperty("tokenVersion");
  });

  it("should call anonymizePersonalData inside the transaction", async () => {
    const { anonymizePersonalData } = await import(
      "@/server/services/user/anonymization"
    );
    const { profileRouter } = await import("../profile");

    // @ts-expect-error — mutation handler captured at import time
    const handler = profileRouter.deleteMyAccount.handler;

    await handler({
      input: { confirmation: "SUPPRIMER" },
      ctx: { session: { user: { id: "user-1" } } },
    });

    expect(anonymizePersonalData).toHaveBeenCalledWith(
      mockDb._mockTx,
      "user-1",
    );
  });
});

describe("userRouter.withdrawConsent — N2 regression test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Pre-check mocks: no active call and consent not already withdrawn
    mockDb.call.findFirst.mockResolvedValue(null);
    mockDb.user.findUnique.mockResolvedValue({ consentWithdrawnAt: null });
  });

  it("should include tokenVersion: { increment: 1 } in user.update", async () => {
    const { userRouter } = await import("../user");

    // @ts-expect-error — mutation handler captured at import time
    const handler = userRouter.withdrawConsent.handler;

    await handler({
      input: { confirmation: "RETIRER" },
      ctx: { session: { user: { id: "user-1" } } },
    });

    // Verify $transaction was called
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);

    // withdrawConsent consolidates all fields into one user.update call,
    // plus anonymizePersonalData calls another update for legacy fields
    const updateCalls = mockDb._mockTx.user.update.mock.calls;

    // At least one update call should contain tokenVersion
    const tokenVersionCall = updateCalls.find(
      (call: any[]) => call[0]?.data?.tokenVersion,
    );
    expect(tokenVersionCall).toBeDefined();
    expect(tokenVersionCall[0].data.tokenVersion).toEqual({ increment: 1 });
  });

  it("should call anonymizePersonalData inside the transaction", async () => {
    const { anonymizePersonalData } = await import(
      "@/server/services/user/anonymization"
    );
    const { userRouter } = await import("../user");

    // @ts-expect-error — mutation handler captured at import time
    const handler = userRouter.withdrawConsent.handler;

    await handler({
      input: { confirmation: "RETIRER" },
      ctx: { session: { user: { id: "user-1" } } },
    });

    expect(anonymizePersonalData).toHaveBeenCalledWith(
      mockDb._mockTx,
      "user-1",
    );
  });
});
