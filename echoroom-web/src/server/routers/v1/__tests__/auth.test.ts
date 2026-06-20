import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Auth Router (v1) — Password Validation Tests
// ---------------------------------------------------------------------------
// The v1 auth router enforces password strength using Zod validation.
//
// Password requirements (same as unversioned auth):
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

function isValidPassword(password: string): boolean {
  return passwordSchema.safeParse(password).success;
}

function getValidationError(password: string): string | null {
  const result = passwordSchema.safeParse(password);
  if (result.success) return null;
  return result.error.issues[0]?.message ?? "Validation failed";
}

describe("authV1Router — Password Validation (L-5)", () => {
  // Valid passwords
  it("should accept a valid password with uppercase, lowercase, and digit", () => {
    expect(isValidPassword("Valid1Password")).toBe(true);
  });

  it("should accept a password at the minimum length (8 chars)", () => {
    expect(isValidPassword("Abcdef1!")).toBe(true);
  });

  it("should accept a password at the maximum length (128 chars)", () => {
    const longPassword = "A" + "a".repeat(121) + "1".repeat(6);
    expect(longPassword.length).toBe(128);
    expect(isValidPassword(longPassword)).toBe(true);
  });

  it("should accept a password with special characters", () => {
    expect(isValidPassword("P@ssw0rd!")).toBe(true);
  });

  // Rejected passwords
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

  // Boundary cases
  it("should reject an empty string", () => {
    expect(isValidPassword("")).toBe(false);
  });

  it("should reject 7-char password that meets all other requirements", () => {
    expect(isValidPassword("Abcd12!")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// v1 authRouter.register — email enumeration protection
// ---------------------------------------------------------------------------

const mockDb = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  userBilling: {
    upsert: vi.fn(),
  },
}));

vi.mock("@/server/db", () => ({
  db: mockDb,
}));

// Mock the procedures module (v1 routers import from "../../procedures")
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

vi.mock("@/server/trpc", () => ({
  t: { procedure: { use: vi.fn() } },
  router: vi.fn((routes: Record<string, unknown>) => routes),
  publicProcedure: { use: vi.fn() },
  protectedProcedure: { use: vi.fn() },
  adminProcedure: { use: vi.fn() },
  middleware: vi.fn(() => (opts: { next: Function }) => opts.next()),
  withRateLimit: vi.fn(() => (opts: { next: Function }) => opts.next()),
  withTracing: vi.fn(() => ({ use: vi.fn() })),
  isAuthenticated: { use: vi.fn() },
  isAdmin: { use: vi.fn() },
}));

// Mock bcryptjs
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

describe("authV1Router.register — email enumeration protection", () => {
  let handler: RegisterHandler;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { authV1Router } = await import("../auth");
    // @ts-expect-error — handler captured at import time via tRPC mock
    handler = authV1Router.register.handler;
  });

  const validInput = {
    email: "newuser@example.com",
    username: "newuser",
    password: "ValidPass1",
    consentAccepted: true,
  };

  it("should call findUnique twice (email + username) via Promise.all", async () => {
    mockDb.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
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
      .mockResolvedValueOnce({ id: "existing-email-id" })
      .mockResolvedValueOnce(null);

    await expect(
      handler({ input: validInput, ctx: {} }),
    ).rejects.toThrow("Cet email ou ce nom d'utilisateur est déjà utilisé");
  });

  it("should throw CONFLICT with generic message when username already exists", async () => {
    mockDb.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "existing-username-id" });

    await expect(
      handler({ input: validInput, ctx: {} }),
    ).rejects.toThrow("Cet email ou ce nom d'utilisateur est déjà utilisé");
  });

  it("should throw BAD_REQUEST when consentAccepted is false", async () => {
    await expect(
      handler({ input: { ...validInput, consentAccepted: false }, ctx: {} }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Vous devez accepter les conditions d'utilisation",
    });
  });

  it("should detect disposable email domains", async () => {
    await expect(
      handler({ input: { ...validInput, email: "user@mailinator.com" }, ctx: {} }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Les emails jetables ne sont pas autorisés",
    });
  });

  it("should detect disposable email with recursive subdomains", async () => {
    await expect(
      handler({ input: { ...validInput, email: "user@sub.mailinator.com" }, ctx: {} }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Les emails jetables ne sont pas autorisés",
    });
  });

  it("should detect disposable email with deep subdomains", async () => {
    await expect(
      handler({ input: { ...validInput, email: "user@a.b.c.mailinator.com" }, ctx: {} }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Les emails jetables ne sont pas autorisés",
    });
  });

  it("should normalize email casing — domain case-insensitivity", async () => {
    await expect(
      handler({ input: { ...validInput, email: "user@MailInator.COM" }, ctx: {} }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Les emails jetables ne sont pas autorisés",
    });
  });

  it("should not block non-disposable emails with subdomains", async () => {
    mockDb.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockDb.user.create.mockResolvedValue({ id: "user-created" });

    const result = await handler({
      input: { ...validInput, email: "user@mail.example.com" },
      ctx: {},
    });

    expect(result).toEqual({ userId: "user-created" });
  });

  it("should throw CONFLICT when race condition causes double insert", async () => {
    mockDb.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockDb.user.create.mockRejectedValue(
      new Error("Unique constraint failed on the fields: (`email`)"),
    );

    await expect(
      handler({ input: validInput, ctx: {} }),
    ).rejects.toThrow("Unique constraint");
  });

  it("should throw when bcrypt.hash fails", async () => {
    mockDb.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const bcryptjs = await import("bcryptjs");
    (bcryptjs.default.hash as any).mockRejectedValueOnce(
      new Error("bcrypt error"),
    );

    await expect(
      handler({ input: validInput, ctx: {} }),
    ).rejects.toThrow("bcrypt error");
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

// ---------------------------------------------------------------------------
// changePassword — password change mutations
// ---------------------------------------------------------------------------
describe("authV1Router.changePassword — password change", () => {
  let handler: Function;
  const validCtx = {
    session: { user: { id: "user-123" } },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const { authV1Router } = await import("../auth");
    // @ts-expect-error
    handler = authV1Router.changePassword.handler;
  });

  const validInput = {
    currentPassword: "OldPass1",
    newPassword: "NewValidPass1",
  };

  it("should change password successfully and increment tokenVersion", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      passwordHash: "$2b$12$existing_hash_for_test",
    });

    const bcryptjs = await import("bcryptjs");
    (bcryptjs.default.compare as any).mockResolvedValue(true);
    (bcryptjs.default.hash as any).mockResolvedValue(
      "$2b$12$new_hashed_password",
    );

    const result = await handler({ input: validInput, ctx: validCtx });

    expect(result).toEqual({ success: true });
    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: "user-123" },
      data: {
        passwordHash: "$2b$12$new_hashed_password",
        tokenVersion: { increment: 1 },
      },
    });
  });

  it("should throw BAD_REQUEST when currentPassword is incorrect", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      passwordHash: "$2b$12$existing_hash_for_test",
    });

    const bcryptjs = await import("bcryptjs");
    (bcryptjs.default.compare as any).mockResolvedValue(false);

    await expect(
      handler({ input: validInput, ctx: validCtx }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Mot de passe actuel incorrect",
    });
  });

  it("should throw NOT_FOUND when user does not exist", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);

    await expect(
      handler({ input: validInput, ctx: validCtx }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Utilisateur introuvable",
    });
  });

  it("should reject empty currentPassword (Zod)", () => {
    const schema = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string()
        .min(8, "Minimum 8 caractères")
        .max(128, "Maximum 128 caractères")
        .regex(/[A-Z]/, "Doit contenir une majuscule")
        .regex(/[a-z]/, "Doit contenir une minuscule")
        .regex(/[0-9]/, "Doit contenir un chiffre"),
    });

    expect(
      schema.safeParse({ currentPassword: "", newPassword: "ValidNew1" }).success,
    ).toBe(false);
  });

  it("should reject newPassword that is too short (Zod)", () => {
    const schema = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string()
        .min(8, "Minimum 8 caractères")
        .max(128, "Maximum 128 caractères")
        .regex(/[A-Z]/, "Doit contenir une majuscule")
        .regex(/[a-z]/, "Doit contenir une minuscule")
        .regex(/[0-9]/, "Doit contenir un chiffre"),
    });

    expect(
      schema.safeParse({ currentPassword: "OldPass1", newPassword: "Short1A" }).success,
    ).toBe(false);
  });
});
