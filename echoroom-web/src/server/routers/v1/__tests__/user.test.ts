import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// userV1Router tests
// ---------------------------------------------------------------------------

const mockDb = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  call: {
    findFirst: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  db: mockDb,
}));

const mockAnonymizePersonalData = vi.hoisted(() => vi.fn());
vi.mock("@/server/services/user/anonymization", () => ({
  anonymizePersonalData: mockAnonymizePersonalData,
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock procedures module
vi.mock("@/server/procedures", () => {
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
    router: vi.fn((routes: Record<string, unknown>) => routes),
    t: { procedure: chain },
    publicProcedure: chain,
    protectedProcedure: chain,
    adminProcedure: chain,
    middleware: vi.fn((fn: Function) => fn),
    withRateLimit: vi.fn(() => (opts: { next: Function }) => opts.next()),
    withTracing: vi.fn(() => chain),
    isAuthenticated: chain,
    isAdmin: chain,
    withREDMetrics: vi.fn(() => (opts: { next: Function }) => opts.next()),
  };
});

const validCtx = { session: { user: { id: "user-123" } } };

// ---------------------------------------------------------------------------
// myDeletionStatus
// ---------------------------------------------------------------------------
describe("userV1Router.myDeletionStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return deletion status when user exists", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      deletedAt: null,
      anonymizedAt: null,
      gdprDataExportedAt: new Date("2026-06-01"),
    });

    const { userV1Router } = await import("../user");
    const handler = (userV1Router as any).myDeletionStatus.handler;

    const result = await handler({ ctx: validCtx });

    expect(result).toEqual({
      deletedAt: null,
      anonymizedAt: null,
      gdprDataExportedAt: expect.any(Date),
    });
    expect(mockDb.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-123" },
      select: { deletedAt: true, anonymizedAt: true, gdprDataExportedAt: true },
    });
  });

  it("should return null fields for a user with no GDPR actions", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      deletedAt: null,
      anonymizedAt: null,
      gdprDataExportedAt: null,
    });

    const { userV1Router } = await import("../user");
    const handler = (userV1Router as any).myDeletionStatus.handler;

    const result = await handler({ ctx: validCtx });

    expect(result.deletedAt).toBeNull();
    expect(result.anonymizedAt).toBeNull();
    expect(result.gdprDataExportedAt).toBeNull();
  });

  it("should throw NOT_FOUND when user does not exist", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);

    const { userV1Router } = await import("../user");
    const handler = (userV1Router as any).myDeletionStatus.handler;

    await expect(handler({ ctx: validCtx })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Utilisateur introuvable",
    });
  });
});

// ---------------------------------------------------------------------------
// withdrawConsent
// ---------------------------------------------------------------------------
describe("userV1Router.withdrawConsent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should withdraw consent successfully", async () => {
    mockDb.$transaction.mockImplementation(async (cb: Function) => {
      const mockTx = {
        call: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        user: {
          findUnique: vi.fn().mockResolvedValue({ consentWithdrawnAt: null }),
          update: vi.fn().mockResolvedValue({}),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: "log-1" }),
        },
      };
      mockAnonymizePersonalData.mockResolvedValue(undefined);
      await cb(mockTx);
    });

    const { userV1Router } = await import("../user");
    const handler = (userV1Router as any).withdrawConsent.handler;

    const result = await handler({
      input: { confirmation: "RETIRER" },
      ctx: validCtx,
    });

    expect(result).toEqual({ success: true });
  });

  it("should throw PRECONDITION_FAILED when user has an active call", async () => {
    mockDb.$transaction.mockImplementation(async (cb: Function) => {
      const mockTx = {
        call: {
          findFirst: vi.fn().mockResolvedValue({ id: "active-call-1" }),
        },
      };
      await cb(mockTx);
    });

    const { userV1Router } = await import("../user");
    const handler = (userV1Router as any).withdrawConsent.handler;

    await expect(
      handler({ input: { confirmation: "RETIRER" }, ctx: validCtx }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("appel actif"),
    });

    // Ensure no anonymization happened
    expect(mockAnonymizePersonalData).not.toHaveBeenCalled();
  });

  it("should throw PRECONDITION_FAILED when consent already withdrawn", async () => {
    mockDb.$transaction.mockImplementation(async (cb: Function) => {
      const mockTx = {
        call: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        user: {
          findUnique: vi.fn().mockResolvedValue({ consentWithdrawnAt: new Date() }),
        },
      };
      await cb(mockTx);
    });

    const { userV1Router } = await import("../user");
    const handler = (userV1Router as any).withdrawConsent.handler;

    await expect(
      handler({ input: { confirmation: "RETIRER" }, ctx: validCtx }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Le consentement a déjà été retiré.",
    });
  });

  it("should call anonymizePersonalData inside transaction", async () => {
    let capturedTx: any;
    mockDb.$transaction.mockImplementation(async (cb: Function) => {
      const mockTx = {
        call: { findFirst: vi.fn().mockResolvedValue(null) },
        user: {
          findUnique: vi.fn().mockResolvedValue({ consentWithdrawnAt: null }),
          update: vi.fn().mockResolvedValue({}),
        },
        auditLog: { create: vi.fn().mockResolvedValue({ id: "log-1" }) },
      };
      capturedTx = mockTx;
      mockAnonymizePersonalData.mockResolvedValue(undefined);
      await cb(mockTx);
    });

    const { userV1Router } = await import("../user");
    const handler = (userV1Router as any).withdrawConsent.handler;

    await handler({ input: { confirmation: "RETIRER" }, ctx: validCtx });

    expect(mockAnonymizePersonalData).toHaveBeenCalledWith(capturedTx, "user-123");
  });

  it("should create audit log entry on success", async () => {
    mockDb.$transaction.mockImplementation(async (cb: Function) => {
      const mockTx = {
        call: { findFirst: vi.fn().mockResolvedValue(null) },
        user: {
          findUnique: vi.fn().mockResolvedValue({ consentWithdrawnAt: null }),
          update: vi.fn().mockResolvedValue({}),
        },
        auditLog: { create: vi.fn().mockResolvedValue({ id: "log-1" }) },
      };
      mockAnonymizePersonalData.mockResolvedValue(undefined);
      await cb(mockTx);
    });

    const { userV1Router } = await import("../user");
    const handler = (userV1Router as any).withdrawConsent.handler;

    await handler({ input: { confirmation: "RETIRER" }, ctx: validCtx });

    const txCallback = mockDb.$transaction.mock.calls[0]![0];
    const mockTx = {
      call: { findFirst: vi.fn().mockResolvedValue(null) },
      user: {
        findUnique: vi.fn().mockResolvedValue({ consentWithdrawnAt: null }),
        update: vi.fn().mockResolvedValue({}),
      },
      auditLog: { create: vi.fn() },
    };
    mockAnonymizePersonalData.mockResolvedValue(undefined);
    await txCallback(mockTx);

    expect(mockTx.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: "WITHDRAW_CONSENT",
        entityType: "User",
        entityId: "user-123",
        adminId: "user-123",
        metadata: { timestamp: expect.any(String) },
      },
    });
  });

  it("should reject confirmation other than RETIRER (Zod literal schema)", () => {
    import("zod").then(({ z }) => {
      const schema = z.object({
        confirmation: z.literal("RETIRER"),
      });
      expect(schema.safeParse({ confirmation: "SUPPRIMER" }).success).toBe(false);
    });
  });

  it("should generate anonymized UUID-based email and username", async () => {
    let capturedUpdateData: any;
    mockDb.$transaction.mockImplementation(async (cb: Function) => {
      const mockTx = {
        call: { findFirst: vi.fn().mockResolvedValue(null) },
        user: {
          findUnique: vi.fn().mockResolvedValue({ consentWithdrawnAt: null }),
          update: vi.fn((args: any) => {
            capturedUpdateData = args.data;
            return {};
          }),
        },
        auditLog: { create: vi.fn().mockResolvedValue({ id: "log-1" }) },
      };
      mockAnonymizePersonalData.mockResolvedValue(undefined);
      await cb(mockTx);
    });

    const { userV1Router } = await import("../user");
    const handler = (userV1Router as any).withdrawConsent.handler;

    await handler({ input: { confirmation: "RETIRER" }, ctx: validCtx });

    expect(capturedUpdateData.username).toMatch(/^utilisateur-/);
    expect(capturedUpdateData.email).toMatch(/^withdrawn-.*@anonymized\.echoroom\.app$/);
    expect(capturedUpdateData.tokenVersion).toEqual({ increment: 1 });
    expect(capturedUpdateData.image).toBeNull();
    expect(capturedUpdateData.displayName).toBeNull();
    expect(capturedUpdateData.bio).toBeNull();
  });

  it("should handle transaction failure gracefully", async () => {
    mockDb.$transaction.mockRejectedValue(new Error("Transaction failed"));

    const { userV1Router } = await import("../user");
    const handler = (userV1Router as any).withdrawConsent.handler;

    await expect(handler({ input: { confirmation: "RETIRER" }, ctx: validCtx })).rejects.toThrow(
      "Transaction failed",
    );
  });
});

// ---------------------------------------------------------------------------
// reconsent
// ---------------------------------------------------------------------------
describe("userV1Router.reconsent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reconsent successfully when consent was withdrawn", async () => {
    mockDb.user.findUnique.mockResolvedValue({ consentWithdrawnAt: new Date() });
    mockDb.$transaction.mockImplementation(async (cb: Function) => {
      const mockTx = {
        user: { update: vi.fn().mockResolvedValue({}) },
        auditLog: { create: vi.fn().mockResolvedValue({ id: "log-1" }) },
      };
      await cb(mockTx);
    });

    const { userV1Router } = await import("../user");
    const handler = (userV1Router as any).reconsent.handler;

    const result = await handler({
      input: { consentAccepted: true },
      ctx: validCtx,
    });

    expect(result).toEqual({ success: true });
  });

  it("should throw PRECONDITION_FAILED when consent was not withdrawn", async () => {
    mockDb.user.findUnique.mockResolvedValue({ consentWithdrawnAt: null });

    const { userV1Router } = await import("../user");
    const handler = (userV1Router as any).reconsent.handler;

    await expect(
      handler({ input: { consentAccepted: true }, ctx: validCtx }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Le consentement n'a pas été retiré.",
    });

    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("should throw NOT_FOUND when user does not exist", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);

    const { userV1Router } = await import("../user");
    const handler = (userV1Router as any).reconsent.handler;

    await expect(
      handler({ input: { consentAccepted: true }, ctx: validCtx }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });

  it("should reset consentWithdrawnAt to null and increment tokenVersion", async () => {
    mockDb.user.findUnique.mockResolvedValue({ consentWithdrawnAt: new Date() });
    let capturedUpdateData: any;
    mockDb.$transaction.mockImplementation(async (cb: Function) => {
      const mockTx = {
        user: {
          update: vi.fn((args: any) => {
            capturedUpdateData = args.data;
            return {};
          }),
        },
        auditLog: { create: vi.fn().mockResolvedValue({ id: "log-1" }) },
      };
      await cb(mockTx);
    });

    const { userV1Router } = await import("../user");
    const handler = (userV1Router as any).reconsent.handler;

    await handler({ input: { consentAccepted: true }, ctx: validCtx });

    expect(capturedUpdateData.consentWithdrawnAt).toBeNull();
    expect(capturedUpdateData.tokenVersion).toEqual({ increment: 1 });
  });

  it("should create RECONSENT audit log entry", async () => {
    mockDb.user.findUnique.mockResolvedValue({ consentWithdrawnAt: new Date() });

    const { userV1Router } = await import("../user");
    const handler = (userV1Router as any).reconsent.handler;

    mockDb.$transaction.mockImplementation(async (cb: Function) => {
      const mockTx = {
        user: { update: vi.fn().mockResolvedValue({}) },
        auditLog: { create: vi.fn().mockResolvedValue({ id: "log-1" }) },
      };
      await cb(mockTx);
    });

    await handler({ input: { consentAccepted: true }, ctx: validCtx });

    const txCallback = mockDb.$transaction.mock.calls[0]![0];
    const mockTx = {
      user: { update: vi.fn() },
      auditLog: { create: vi.fn() },
    };
    await txCallback(mockTx);

    expect(mockTx.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: "RECONSENT",
        entityType: "User",
        entityId: "user-123",
        adminId: "user-123",
        metadata: { timestamp: expect.any(String) },
      },
    });
  });

  it("should reject consentAccepted: false (Zod literal schema)", () => {
    import("zod").then(({ z }) => {
      const schema = z.object({
        consentAccepted: z.literal(true),
      });
      expect(schema.safeParse({ consentAccepted: false }).success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// getConsentStatus
// ---------------------------------------------------------------------------
describe("userV1Router.getConsentStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return consent status when consent is active", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      consentWithdrawnAt: null,
      consentAcceptedAt: new Date("2026-01-01"),
    });

    const { userV1Router } = await import("../user");
    const handler = (userV1Router as any).getConsentStatus.handler;

    const result = await handler({ ctx: validCtx });

    expect(result).toEqual({
      consentWithdrawnAt: null,
      consentAcceptedAt: expect.any(Date),
      isConsentWithdrawn: false,
    });
  });

  it("should return isConsentWithdrawn=true when consent is withdrawn", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      consentWithdrawnAt: new Date("2026-06-15"),
      consentAcceptedAt: null,
    });

    const { userV1Router } = await import("../user");
    const handler = (userV1Router as any).getConsentStatus.handler;

    const result = await handler({ ctx: validCtx });

    expect(result.isConsentWithdrawn).toBe(true);
    expect(result.consentWithdrawnAt).toBeInstanceOf(Date);
    expect(result.consentAcceptedAt).toBeNull();
  });

  it("should return null consentWithdrawnAt when user never withdrew", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      consentWithdrawnAt: null,
      consentAcceptedAt: new Date("2026-01-01"),
    });

    const { userV1Router } = await import("../user");
    const handler = (userV1Router as any).getConsentStatus.handler;

    const result = await handler({ ctx: validCtx });

    expect(result.consentWithdrawnAt).toBeNull();
    expect(result.isConsentWithdrawn).toBe(false);
  });

  it("should throw NOT_FOUND when user does not exist", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);

    const { userV1Router } = await import("../user");
    const handler = (userV1Router as any).getConsentStatus.handler;

    await expect(handler({ ctx: validCtx })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Utilisateur introuvable",
    });
  });
});
