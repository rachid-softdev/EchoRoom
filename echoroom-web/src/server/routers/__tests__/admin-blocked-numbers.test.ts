import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Admin blocked numbers tests
// ---------------------------------------------------------------------------

const TEST_AUDIT_SECRET = "audit_hash_test_secret_16ch!";

const mockDb = vi.hoisted(() => ({
  blockedNumber: {
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
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

vi.mock("@/lib/env", () => ({
  env: {
    AUDIT_HASH_SECRET: TEST_AUDIT_SECRET,
  },
}));

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
    adminProcedure: chain,
    publicProcedure: chain,
    protectedProcedure: chain,
    middleware: vi.fn((fn: Function) => fn),
    withRateLimit: vi.fn(() => (opts: { next: Function }) => opts.next()),
  };
});

// ─── blockNumber ───────────────────────────────────────────────────────────

describe("adminRouter.blockNumber", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.blockedNumber.findUnique.mockResolvedValue(null);
    mockDb.blockedNumber.create.mockResolvedValue({
      id: "blocked-1",
      phoneNumber: "+33612345678",
    });
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });
    mockRedis.del.mockResolvedValue(1);
  });

  it("should block a valid international phone number", async () => {
    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).blockNumber.handler;

    const result = await handler({
      input: { phoneNumber: "+33612345678" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(result).toEqual({ success: true, id: "blocked-1" });
    expect(mockDb.blockedNumber.create).toHaveBeenCalledWith({
      data: {
        phoneNumber: "+33612345678",
        blockedById: "admin-1",
      },
    });
    expect(mockDb.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it("should block number with a reason", async () => {
    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).blockNumber.handler;

    const result = await handler({
      input: { phoneNumber: "+33612345678", reason: "Spam detected" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(result).toEqual({ success: true, id: "blocked-1" });
    expect(mockDb.blockedNumber.create).toHaveBeenCalledWith({
      data: {
        phoneNumber: "+33612345678",
        reason: "Spam detected",
        blockedById: "admin-1",
      },
    });
  });

  it("should block number without a reason", async () => {
    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).blockNumber.handler;

    await handler({
      input: { phoneNumber: "+33612345678" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    // reason should not be in the data when not provided
    const createData = mockDb.blockedNumber.create.mock.calls[0][0].data;
    expect(createData).not.toHaveProperty("reason");
  });

  it("should throw CONFLICT when number is already blocked", async () => {
    mockDb.blockedNumber.findUnique.mockResolvedValue({
      id: "existing",
      phoneNumber: "+33612345678",
    });

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).blockNumber.handler;

    await expect(
      handler({
        input: { phoneNumber: "+33612345678" },
        ctx: { session: { user: { id: "admin-1" } } },
      }),
    ).rejects.toThrow("Ce numéro est déjà bloqué");

    expect(mockDb.blockedNumber.create).not.toHaveBeenCalled();
  });

  it("should throw CONFLICT with code CONFLICT when already blocked", async () => {
    mockDb.blockedNumber.findUnique.mockResolvedValue({
      id: "existing",
      phoneNumber: "+33612345678",
    });

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).blockNumber.handler;

    try {
      await handler({
        input: { phoneNumber: "+33612345678" },
        ctx: { session: { user: { id: "admin-1" } } },
      });
      expect.unreachable("Expected error");
    } catch (e: any) {
      expect(e.code).toBe("CONFLICT");
    }
  });

  it("should reject invalid phone number format (too short) — Zod schema", () => {
    // Zod validation: /^\+[1-9]\d{6,14}$/
    // Since the handler is called directly (bypassing tRPC .input() validation),
    // we test the Zod schema directly
    const blockNumberSchema = z.object({
      phoneNumber: z.string().regex(/^\+[1-9]\d{6,14}$/, "Format international requis"),
      reason: z.string().max(500).optional(),
    });

    const result = blockNumberSchema.safeParse({
      phoneNumber: "+123456",
    });
    expect(result.success).toBe(false);
  });

  it("should reject phone number without + prefix — Zod schema", () => {
    const blockNumberSchema = z.object({
      phoneNumber: z.string().regex(/^\+[1-9]\d{6,14}$/, "Format international requis"),
      reason: z.string().max(500).optional(),
    });

    const result = blockNumberSchema.safeParse({
      phoneNumber: "33612345678",
    });
    expect(result.success).toBe(false);
  });

  it("should reject phone number with non-digit characters — Zod schema", () => {
    const blockNumberSchema = z.object({
      phoneNumber: z.string().regex(/^\+[1-9]\d{6,14}$/, "Format international requis"),
      reason: z.string().max(500).optional(),
    });

    const result = blockNumberSchema.safeParse({
      phoneNumber: "+33a1234567",
    });
    expect(result.success).toBe(false);
  });

  it("should store audit log metadata with HMAC hash", async () => {
    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).blockNumber.handler;

    await handler({
      input: { phoneNumber: "+33612345678" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    const auditCall = mockDb.auditLog.create.mock.calls[0][0];
    const metadata = auditCall.data.metadata;
    expect(metadata).toBeDefined();
    expect(metadata.phoneNumber).toMatch(/^blocked-[0-9a-f]{16}$/);
  });

  it("should invalidate blocked numbers cache after blocking", async () => {
    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).blockNumber.handler;

    await handler({
      input: { phoneNumber: "+33612345678" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(mockRedis.del).toHaveBeenCalledWith("admin:blockedNumbers");
  });

  it("should reject reason longer than 500 characters — Zod schema", () => {
    const blockNumberSchema = z.object({
      phoneNumber: z.string().regex(/^\+[1-9]\d{6,14}$/, "Format international requis"),
      reason: z.string().max(500).optional(),
    });

    const result = blockNumberSchema.safeParse({
      phoneNumber: "+33612345678",
      reason: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("should accept reason of exactly 500 characters (boundary)", async () => {
    mockDb.blockedNumber.findUnique.mockResolvedValue(null);
    mockDb.blockedNumber.create.mockResolvedValue({
      id: "blocked-1",
      phoneNumber: "+33612345678",
    });

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).blockNumber.handler;

    const result = await handler({
      input: {
        phoneNumber: "+33612345678",
        reason: "x".repeat(500),
      },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(result).toEqual({ success: true, id: "blocked-1" });
    const createData = mockDb.blockedNumber.create.mock.calls[0][0].data;
    expect(createData.reason).toHaveLength(500);
  });
});

// ─── unblockNumber ─────────────────────────────────────────────────────────

describe("adminRouter.unblockNumber", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.blockedNumber.findUnique.mockResolvedValue({
      id: "blocked-1",
      phoneNumber: "+33612345678",
    });
    mockDb.blockedNumber.delete.mockResolvedValue({ id: "blocked-1" });
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });
    mockRedis.del.mockResolvedValue(1);
  });

  it("should unblock an existing blocked number", async () => {
    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).unblockNumber.handler;

    const result = await handler({
      input: { id: "blocked-1" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(result).toEqual({ success: true });
    expect(mockDb.blockedNumber.delete).toHaveBeenCalledWith({
      where: { id: "blocked-1" },
    });
    expect(mockDb.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: "UNBLOCK_NUMBER",
        entityType: "BlockedNumber",
        entityId: "blocked-1",
        adminId: "admin-1",
        metadata: { phoneNumber: expect.stringMatching(/^blocked-[0-9a-f]{16}$/) },
      },
    });
  });

  it("should throw NOT_FOUND when blocked entry does not exist", async () => {
    mockDb.blockedNumber.findUnique.mockResolvedValue(null);

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).unblockNumber.handler;

    await expect(
      handler({
        input: { id: "nonexistent" },
        ctx: { session: { user: { id: "admin-1" } } },
      }),
    ).rejects.toThrow("Entrée introuvable");

    expect(mockDb.blockedNumber.delete).not.toHaveBeenCalled();
  });

  it("should invalidate blocked numbers cache after unblocking", async () => {
    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).unblockNumber.handler;

    await handler({
      input: { id: "blocked-1" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(mockRedis.del).toHaveBeenCalledWith("admin:blockedNumbers");
  });

  it("should store audit metadata with HMAC hash on unblock", async () => {
    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).unblockNumber.handler;

    await handler({
      input: { id: "blocked-1" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    const auditCall = mockDb.auditLog.create.mock.calls[0][0];
    expect(auditCall.data.metadata.phoneNumber).toMatch(/^blocked-[0-9a-f]{16}$/);
  });
});

// ─── getBlockedNumbers ─────────────────────────────────────────────────────

describe("adminRouter.getBlockedNumbers", () => {
  const makeBlocked = (id: string, phone: string) => ({
    id,
    phoneNumber: phone,
    createdAt: new Date(),
    reason: null,
    blockedBy: { id: "admin-1", username: "admin" },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.get.mockReset();
    mockRedis.set.mockReset();
  });

  it("should return all blocked numbers", async () => {
    const items = [
      makeBlocked("b-1", "+33612345678"),
      makeBlocked("b-2", "+33687654321"),
    ];
    mockRedis.get.mockResolvedValue(null);
    mockDb.blockedNumber.findMany.mockResolvedValue(items);

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).getBlockedNumbers.handler;

    const result = await handler({
      input: undefined,
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe("b-1");
    expect(mockDb.blockedNumber.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      include: {
        blockedBy: { select: { id: true, username: true } },
      },
    });
  });

  it("should return cached result when cache is hit", async () => {
    const cached = { items: [makeBlocked("b-cached", "+33600000000")] };
    mockRedis.get.mockResolvedValue(JSON.stringify(cached));

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).getBlockedNumbers.handler;

    const result = await handler({
      input: undefined,
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("b-cached");
    expect(mockDb.blockedNumber.findMany).not.toHaveBeenCalled();
  });

  it("should query db and cache result on miss", async () => {
    const items = [makeBlocked("b-1", "+33612345678")];
    mockRedis.get.mockResolvedValue(null);
    mockDb.blockedNumber.findMany.mockResolvedValue(items);

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).getBlockedNumbers.handler;

    const result = await handler({
      input: undefined,
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(result.items).toHaveLength(1);
    expect(mockRedis.set).toHaveBeenCalledWith(
      "admin:blockedNumbers",
      JSON.stringify({ items }),
      { ex: 30 },
    );
  });

  it("should invalidate cache after blocking a number", async () => {
    mockDb.blockedNumber.findUnique.mockResolvedValue(null);
    mockDb.blockedNumber.create.mockResolvedValue({
      id: "b-new",
      phoneNumber: "+33699999999",
    });
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).blockNumber.handler;

    await handler({
      input: { phoneNumber: "+33699999999" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(mockRedis.del).toHaveBeenCalledWith("admin:blockedNumbers");
  });

  it("should invalidate cache after unblocking a number", async () => {
    mockDb.blockedNumber.findUnique.mockResolvedValue({
      id: "b-1",
      phoneNumber: "+33612345678",
    });
    mockDb.blockedNumber.delete.mockResolvedValue({ id: "b-1" });
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });

    const { adminRouter } = await import("../admin");
    const handler = (adminRouter as any).unblockNumber.handler;

    await handler({
      input: { id: "b-1" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    expect(mockRedis.del).toHaveBeenCalledWith("admin:blockedNumbers");
  });
});
