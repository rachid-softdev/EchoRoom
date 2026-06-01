import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Auth Router — Password Validation Tests
// ---------------------------------------------------------------------------
// The auth router (src/server/routers/auth.ts) enforces password strength
// using Zod validation. The schema is embedded in the .input() call and
// not exported, so we replicate it here to verify the contract.
//
// Password requirements (L-5):
//   - Minimum 8 characters
//   - Maximum 128 characters
//   - At least one uppercase letter (A-Z)
//   - At least one lowercase letter (a-z)
//   - At least one digit (0-9)

const passwordSchema = z
  .string()
  .min(8, "Minimum 8 caractères")
  .max(128, "Maximum 128 caractères")
  .regex(/[A-Z]/, "Doit contenir une majuscule")
  .regex(/[a-z]/, "Doit contenir une minuscule")
  .regex(/[0-9]/, "Doit contenir un chiffre");

// Helper: safeParse returns true if validation passes
function isValidPassword(password: string): boolean {
  return passwordSchema.safeParse(password).success;
}

function getValidationError(password: string): string | null {
  const result = passwordSchema.safeParse(password);
  if (result.success) return null;
  return result.error.issues[0]?.message ?? "Validation failed";
}

describe("Auth Router — Password Validation (L-5)", () => {
  // -----------------------------------------------------------------------
  // Valid passwords
  // -----------------------------------------------------------------------

  it("should accept a valid password with uppercase, lowercase, and digit", () => {
    expect(isValidPassword("Valid1Password")).toBe(true);
  });

  it("should accept a password at the minimum length (8 chars)", () => {
    expect(isValidPassword("Abcdef1!")).toBe(true);
  });

  it("should accept a password at the maximum length (128 chars)", () => {
    // Construct: 1 uppercase + 121 lowercase + 6 digits = 128 chars
    const longPassword = "A" + "a".repeat(121) + "1".repeat(6);
    expect(longPassword.length).toBe(128);
    expect(isValidPassword(longPassword)).toBe(true);
  });

  it("should accept a password with special characters", () => {
    expect(isValidPassword("P@ssw0rd!")).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Rejected passwords — missing requirements
  // -----------------------------------------------------------------------

  it("should reject a password without uppercase letters", () => {
    expect(isValidPassword("nouppercase1")).toBe(false);
    const error = getValidationError("nouppercase1");
    expect(error).toContain("majuscule");
  });

  it("should reject a password without lowercase letters", () => {
    expect(isValidPassword("NOLOWERCASE1")).toBe(false);
    const error = getValidationError("NOLOWERCASE1");
    expect(error).toContain("minuscule");
  });

  it("should reject a password without digits", () => {
    expect(isValidPassword("NoDigitsHere")).toBe(false);
    const error = getValidationError("NoDigitsHere");
    expect(error).toContain("chiffre");
  });

  it("should reject a password that is too short (less than 8 chars)", () => {
    expect(isValidPassword("Short1A")).toBe(false);
    const error = getValidationError("Short1A");
    expect(error).toContain("8");
  });

  it("should reject a password that is too long (more than 128 chars)", () => {
    const tooLong = "A1" + "a".repeat(128);
    expect(isValidPassword(tooLong)).toBe(false);
    const error = getValidationError(tooLong);
    expect(error).toContain("128");
  });

  // -----------------------------------------------------------------------
  // Boundary cases
  // -----------------------------------------------------------------------

  it("should reject an empty string", () => {
    expect(isValidPassword("")).toBe(false);
  });

  it("should reject a password with only uppercase and digits (no lowercase)", () => {
    expect(isValidPassword("UPPERCASE1")).toBe(false);
  });

  it("should reject a password with only lowercase and digits (no uppercase)", () => {
    expect(isValidPassword("lowercase1")).toBe(false);
  });

  it("should reject a password with only letters (no digits)", () => {
    expect(isValidPassword("UppercaseLowercase")).toBe(false);
  });

  it("should reject 7-char password that meets all other requirements", () => {
    // 7 chars is too short even if it has upper, lower, digit
    expect(isValidPassword("Abcd12!")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Email/Username enumeration protection (S-5 fix)
// ---------------------------------------------------------------------------
// Tests that the register mutation uses Promise.all for parallel queries
// and returns a generic error message that doesn't reveal which field exists.

vi.mock("@/server/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    userBilling: {
      upsert: vi.fn(),
    },
  },
}));

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

// Mock bcryptjs to avoid expensive hashing in tests
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2b$12$mocked_hash_value"),
    compare: vi.fn(),
  },
}));

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

type RegisterInput = {
  input: {
    email: string;
    username: string;
    password: string;
    consentAccepted: boolean;
  };
  ctx: Record<string, never>;
};

type RegisterHandler = (opts: RegisterInput) => Promise<{ userId: string }>;

describe("authRouter.register — email enumeration protection", () => {
  let mockDb: any;
  let handler: RegisterHandler;

  beforeEach(async () => {
    vi.clearAllMocks();

    const dbModule = await import("@/server/db");
    mockDb = dbModule.db;

    const { authRouter } = await import("../auth");

    // @ts-expect-error — handler captured at import time via tRPC mock
    handler = authRouter.register.handler;
  });

  const validInput = {
    email: "newuser@example.com",
    username: "newuser",
    password: "ValidPass1",
    consentAccepted: true,
  };

  it("should call findUnique twice (email + username) via Promise.all", async () => {
    // Promise.all ensures both queries run in parallel
    mockDb.user.findUnique
      .mockResolvedValueOnce(null) // email check
      .mockResolvedValueOnce(null); // username check
    mockDb.user.create.mockResolvedValue({ id: "user-new" });

    const result = await handler({ input: validInput, ctx: {} });

    expect(result).toEqual({ userId: "user-new" });
    expect(mockDb.user.findUnique).toHaveBeenCalledTimes(2);
    expect(mockDb.user.findUnique).toHaveBeenNthCalledWith(1, {
      where: { email: "newuser@example.com" },
      select: { id: true },
    });
    expect(mockDb.user.findUnique).toHaveBeenNthCalledWith(2, {
      where: { username: "newuser" },
      select: { id: true },
    });
  });

  it("should throw CONFLICT with generic message when email already exists", async () => {
    mockDb.user.findUnique
      .mockResolvedValueOnce({ id: "existing-email-id" }) // email exists
      .mockResolvedValueOnce(null); // username doesn't

    await expect(
      handler({ input: validInput, ctx: {} }),
    ).rejects.toThrow("Cet email ou ce nom d'utilisateur est déjà utilisé");
  });

  it("should throw CONFLICT with generic message when username already exists", async () => {
    mockDb.user.findUnique
      .mockResolvedValueOnce(null) // email doesn't exist
      .mockResolvedValueOnce({ id: "existing-username-id" }); // username exists

    await expect(
      handler({ input: validInput, ctx: {} }),
    ).rejects.toThrow("Cet email ou ce nom d'utilisateur est déjà utilisé");
  });

  it("should throw the SAME error message for email conflict and username conflict", async () => {
    let emailError: Error | null = null;
    let usernameError: Error | null = null;

    // Test email conflict
    mockDb.user.findUnique
      .mockReset()
      .mockResolvedValueOnce({ id: "existing-email-id" }) // email exists
      .mockResolvedValueOnce(null);

    try {
      await handler({ input: validInput, ctx: {} });
    } catch (e: any) {
      emailError = e;
    }

    // Reset mocks
    vi.clearAllMocks();

    // Re-import to get fresh handler
    const { authRouter: authRouter2 } = await import("../auth");
    // @ts-expect-error
    const handler2: RegisterHandler = authRouter2.register.handler;

    // Test username conflict
    mockDb.user.findUnique
      .mockReset()
      .mockResolvedValueOnce(null) // email doesn't exist
      .mockResolvedValueOnce({ id: "existing-username-id" }); // username exists

    try {
      await handler2({ input: { ...validInput, username: "otheruser" }, ctx: {} });
    } catch (e: any) {
      usernameError = e;
    }

    expect(emailError).not.toBeNull();
    expect(usernameError).not.toBeNull();
    expect(emailError!.message).toBe(usernameError!.message);
    expect(emailError!.message).toBe(
      "Cet email ou ce nom d'utilisateur est déjà utilisé",
    );
  });

  it("should throw CONFLICT error code (not BAD_REQUEST)", async () => {
    mockDb.user.findUnique
      .mockResolvedValueOnce({ id: "existing-id" })
      .mockResolvedValueOnce(null);

    try {
      await handler({ input: validInput, ctx: {} });
      expect.unreachable("Should have thrown");
    } catch (e: any) {
      // tRPC TRPCError has a code property
      expect(e.code).toBe("CONFLICT");
    }
  });

  it("should not reveal which field caused the conflict in the error message", async () => {
    // When email exists, the message should mention BOTH "email" and "username"
    // generically, not just the one that matched
    mockDb.user.findUnique
      .mockResolvedValueOnce({ id: "existing-id" })
      .mockResolvedValueOnce(null);

    try {
      await handler({ input: validInput, ctx: {} });
    } catch (e: any) {
      // The message must be generic: it should mention BOTH "email" and "nom d'utilisateur"
      // together, so the caller cannot infer which one caused the conflict
      expect(e.message).toMatch(/email/i);
      expect(e.message).toMatch(/utilisateur/i);
    }
  });

  it("should succeed when neither email nor username exist", async () => {
    mockDb.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockDb.user.create.mockResolvedValue({ id: "user-created" });

    const result = await handler({ input: validInput, ctx: {} });

    expect(result).toEqual({ userId: "user-created" });
    expect(mockDb.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "newuser@example.com",
          username: "newuser",
        }),
      }),
    );
  });
});
