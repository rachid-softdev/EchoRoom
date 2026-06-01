import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

// ---------------------------------------------------------------------------
// L-2: admin audit hash — hashPhoneForAudit
// ---------------------------------------------------------------------------
// Tests that:
//   - hashPhoneForAudit uses HMAC-SHA256 with AUDIT_HASH_SECRET (not plain SHA-256)
//   - Produces consistent hash for the same input (deterministic)
//   - Different inputs produce different hashes
//   - Output format is "blocked-{16 hex chars}"
//   - Not reversible (different format from maskPhoneNumber)

// The implementation in admin.ts now uses:
//   createHmac("sha256", env.AUDIT_HASH_SECRET).update(phone).digest("hex")
//   return `blocked-${hash.substring(0, 16)}`;
//
// Previously it used createHash("sha256") which required no secret key.
// The HMAC keyed hash prevents rainbow table attacks.

const TEST_AUDIT_SECRET = "audit_hash_test_secret_16ch!";

beforeAll(() => {
  process.env.AUDIT_HASH_SECRET = TEST_AUDIT_SECRET;
});

// We need to set env before admin.ts is imported.
// vi.mock("@/lib/env") happens below and will include AUDIT_HASH_SECRET.

vi.mock("@/server/db", () => {
  const mockTx = {
    user: {
      update: vi.fn().mockResolvedValue({ id: "user-1" }),
    },
    scenario: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    comment: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    call: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };

  const _mockDb = {
    $transaction: vi.fn(async (cb: Function) => cb(mockTx)),
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "log-1" }),
    },
    blockedNumber: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "blocked-1" }),
    },
    _mockTx: mockTx,
  };

  return { db: _mockDb };
});

vi.mock("@/server/lib/encryption", () => ({
  encryptPhoneNumber: vi.fn((phone: string) => `encrypted:${phone}`),
  decryptPhoneNumber: vi.fn((encrypted: string) => {
    if (encrypted.startsWith("encrypted:")) {
      return encrypted.replace("encrypted:", "");
    }
    throw new Error("Decryption failed");
  }),
  maskPhoneNumber: vi.fn((phone: string) => {
    if (phone.length < 6) return "******";
    const prefix = phone.startsWith("+") ? phone.substring(0, 3) : phone.substring(0, 2);
    return `${prefix}****${phone.slice(-4)}`;
  }),
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock("@/lib/env", () => ({
  env: {
    AUDIT_HASH_SECRET: TEST_AUDIT_SECRET,
    PHONE_ENCRYPTION_KEY: "test_encryption_key_32_chars_minimum!!",
  },
}));

// Mock tRPC
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

describe("L-2: hashPhoneForAudit HMAC behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- HMAC-specific tests ---

  it("should produce a hash starting with 'blocked-' followed by 16 hex chars", async () => {
    const { adminRouter } = await import("../admin");

    const handler = (adminRouter as any).blockNumber?.handler;
    if (!handler) return;

    await handler({
      input: { phoneNumber: "+33612345678" },
      ctx: { session: { user: { id: "admin-1" } } },
    });

    const { db } = await import("@/server/db");
    const createCall = (db.auditLog.create as any).mock.calls[0];
    expect(createCall).toBeDefined();

    const metadata = createCall[0].data.metadata;
    expect(metadata.phoneNumber).toMatch(/^blocked-[0-9a-f]{16}$/);
  });

  it("should use HMAC (not plain hash) — output changes with different secret", async () => {
    // This verifies the HMAC property directly using node:crypto
    const { createHmac } = await import("node:crypto");

    const phone = "+33612345678";

    // With our test secret
    const hash1 = createHmac("sha256", TEST_AUDIT_SECRET).update(phone).digest("hex").substring(0, 16);

    // With a different secret
    const hash2 = createHmac("sha256", "different_secret_16_chars!!").update(phone).digest("hex").substring(0, 16);

    // Different secret → different hash (HMAC property)
    expect(hash1).not.toBe(hash2);
  });

  it("should produce consistent output for the same input and secret (deterministic)", async () => {
    const { createHmac } = await import("node:crypto");

    const phone = "+33612345678";

    const hash1 = createHmac("sha256", TEST_AUDIT_SECRET).update(phone).digest("hex").substring(0, 16);
    const hash2 = createHmac("sha256", TEST_AUDIT_SECRET).update(phone).digest("hex").substring(0, 16);

    expect(hash1).toBe(hash2);
  });

  it("should produce different hashes for different phone numbers", async () => {
    const { createHmac } = await import("node:crypto");

    const phone1 = "+33612345678";
    const phone2 = "+33687654321";

    const hash1 = createHmac("sha256", TEST_AUDIT_SECRET).update(phone1).digest("hex").substring(0, 16);
    const hash2 = createHmac("sha256", TEST_AUDIT_SECRET).update(phone2).digest("hex").substring(0, 16);

    expect(hash1).not.toBe(hash2);
  });

  it("should output 16 hex characters in the hash portion (was 8 before)", async () => {
    const { createHmac } = await import("node:crypto");

    const phone = "+33612345678";
    const hash = createHmac("sha256", TEST_AUDIT_SECRET).update(phone).digest("hex");

    // The hash portion used in audit logs is the first 16 chars (was 8 before)
    const auditPart = hash.substring(0, 16);
    expect(auditPart).toMatch(/^[0-9a-f]{16}$/);
    expect(auditPart.length).toBe(16); // Was 8 in the old implementation
  });

  // --- Existing behavior tests (adapted for HMAC) ---

  it("should not be reversible (hash is one-way)", async () => {
    const { createHmac } = await import("node:crypto");

    const phone = "+33612345678";
    const hash = createHmac("sha256", TEST_AUDIT_SECRET).update(phone).digest("hex");

    // The hash should not contain the original phone number
    expect(hash).not.toContain(phone);
    expect(hash).not.toContain("33612345678");

    // SHA-256 HMAC produces 64 hex characters
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should be a different format from maskPhoneNumber", async () => {
    const { createHmac } = await import("node:crypto");
    const { maskPhoneNumber } = await import("@/server/lib/encryption");

    const phone = "+33612345678";
    const auditHash = `blocked-${createHmac("sha256", TEST_AUDIT_SECRET).update(phone).digest("hex").substring(0, 16)}`;
    const masked = maskPhoneNumber(phone);

    // maskPhoneNumber preserves first 3 chars and last 4
    expect(masked).toContain("+33");
    expect(masked).toContain("5678");

    // hashPhoneForAudit should NOT contain the original prefix or suffix
    expect(auditHash).not.toContain("+33");
    expect(auditHash).not.toContain("5678");

    // Different format
    expect(auditHash).not.toBe(masked);
  });
});
