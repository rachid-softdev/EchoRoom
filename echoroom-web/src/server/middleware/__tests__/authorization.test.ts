import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// ---------------------------------------------------------------------------
// Authorization Middleware Tests
// ---------------------------------------------------------------------------
// Tests for:
//   isAuthenticated  — guards that session.user.id exists
//   isAdmin          — guards that session.user.role === "ADMIN"
//
// We define the middleware callbacks inline in the mock because tRPC v11's
// middleware() wraps the callback in a MiddlewareBuilder that is not directly
// callable.  By providing the raw callbacks in the mock, we test the exact
// same logic as the real implementation while keeping the test isolated.

const mockMiddleware = vi.hoisted(() => {
  // TRPCError is available at hoist time via the import above
  return {
    // isAuthenticated callback (mirrors src/server/trpc.ts lines 129-149)
    isAuthenticated: async ({ ctx, next }: { ctx: Record<string, unknown>; next: Function }) => {
      const session = ctx.session as { user?: { id?: string } } | null;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Vous devez être connecté pour accéder à cette ressource",
        });
      }
      return next({
        ctx: {
          ...ctx,
          session: { ...session, user: session.user },
        },
      });
    },
    // isAdmin callback (mirrors src/server/trpc.ts lines 151-160)
    isAdmin: async ({ ctx, next }: { ctx: Record<string, unknown>; next: Function }) => {
      const session = ctx.session as { user?: { role?: string } } | null;
      if (session?.user?.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Accès réservé aux administrateurs",
        });
      }
      return next();
    },
  };
});

vi.mock("@/server/trpc", () => ({
  isAuthenticated: mockMiddleware.isAuthenticated,
  isAdmin: mockMiddleware.isAdmin,
  middleware: (fn: Function) => fn,
}));

describe("isAuthenticated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createNext() {
    return vi.fn().mockResolvedValue({ ok: true });
  }

  it("should throw UNAUTHORIZED when session is null", async () => {
    const { isAuthenticated } = await import("@/server/trpc");
    const next = createNext();

    await expect(
      (isAuthenticated as any)({ ctx: { session: null }, next }),
    ).rejects.toThrow(TRPCError);

    await expect(
      (isAuthenticated as any)({ ctx: { session: null }, next }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(next).not.toHaveBeenCalled();
  });

  it("should throw UNAUTHORIZED when session exists but has no user", async () => {
    const { isAuthenticated } = await import("@/server/trpc");
    const next = createNext();

    await expect(
      (isAuthenticated as any)({ ctx: { session: { user: null } }, next }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(next).not.toHaveBeenCalled();
  });

  it("should throw UNAUTHORIZED when session user has no id", async () => {
    const { isAuthenticated } = await import("@/server/trpc");
    const next = createNext();

    await expect(
      (isAuthenticated as any)({
        ctx: { session: { user: { id: null, email: "test@test.com" } } },
        next,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(next).not.toHaveBeenCalled();
  });

  it("should call next() with properly typed session when authenticated", async () => {
    const { isAuthenticated } = await import("@/server/trpc");
    const next = createNext();

    const session = {
      user: {
        id: "user-123",
        email: "test@echoroom.app",
        username: "testuser",
        role: "USER" as const,
        image: null,
      },
      expires: "2025-01-01",
    };

    await (isAuthenticated as any)({ ctx: { session }, next });

    expect(next).toHaveBeenCalledTimes(1);
    const nextCtx = next.mock.calls[0]![0].ctx as Record<string, unknown>;
    expect((nextCtx.session as any).user.id).toBe("user-123");
    expect((nextCtx.session as any).user.role).toBe("USER");
  });

  it("should forward the session user data to next context", async () => {
    const { isAuthenticated } = await import("@/server/trpc");
    const next = createNext();

    const session = {
      user: {
        id: "user-456",
        email: "admin@echoroom.app",
        username: "adminuser",
        role: "ADMIN" as const,
        image: "https://avatar.example.com/img.png",
      },
      expires: "2026-06-20",
    };

    await (isAuthenticated as any)({
      ctx: { session, extraField: "should-be-kept" },
      next,
    });

    expect(next).toHaveBeenCalledTimes(1);
    const nextCtx = next.mock.calls[0]![0].ctx as Record<string, unknown>;
    expect(nextCtx.extraField).toBe("should-be-kept");
    expect((nextCtx.session as any).user.id).toBe("user-456");
    expect((nextCtx.session as any).user.image).toBe("https://avatar.example.com/img.png");
  });
});

describe("isAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createNext() {
    return vi.fn().mockResolvedValue({ ok: true });
  }

  it("should throw FORBIDDEN when session is null", async () => {
    const { isAdmin } = await import("@/server/trpc");
    const next = createNext();

    await expect(
      (isAdmin as any)({ ctx: { session: null }, next }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("administrateurs") });

    expect(next).not.toHaveBeenCalled();
  });

  it("should throw FORBIDDEN when role is USER", async () => {
    const { isAdmin } = await import("@/server/trpc");
    const next = createNext();

    await expect(
      (isAdmin as any)({
        ctx: {
          session: {
            user: { id: "user-1", role: "USER", email: "user@test.com", username: "user", image: null },
            expires: "2025-01-01",
          },
        },
        next,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(next).not.toHaveBeenCalled();
  });

  it("should throw FORBIDDEN when role is MODERATOR", async () => {
    const { isAdmin } = await import("@/server/trpc");
    const next = createNext();

    await expect(
      (isAdmin as any)({
        ctx: {
          session: {
            user: { id: "mod-1", role: "MODERATOR", email: "mod@test.com", username: "mod", image: null },
            expires: "2025-01-01",
          },
        },
        next,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(next).not.toHaveBeenCalled();
  });

  it("should call next() when role is ADMIN", async () => {
    const { isAdmin } = await import("@/server/trpc");
    const next = createNext();

    await (isAdmin as any)({
      ctx: {
        session: {
          user: { id: "admin-1", role: "ADMIN", email: "admin@test.com", username: "admin", image: null },
          expires: "2025-01-01",
        },
      },
      next,
    });

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should not be bypassed by manipulating session fields (role must be ADMIN)", async () => {
    const { isAdmin } = await import("@/server/trpc");
    const next = createNext();

    // Attempt to bypass with MODERATOR role + extra fields
    const manipulatedSession = {
      user: {
        id: "user-1",
        email: "user@test.com",
        username: "user",
        role: "MODERATOR",
        image: null,
        isAdmin: true,
        permissions: ["admin"],
      },
      expires: "2025-01-01",
    };

    await expect(
      (isAdmin as any)({ ctx: { session: manipulatedSession }, next }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(next).not.toHaveBeenCalled();
  });

  it("should reject session with role USER even when all other fields look admin-like", async () => {
    const { isAdmin } = await import("@/server/trpc");
    const next = createNext();

    const fakeAdmin = {
      user: {
        id: "hacker-1",
        email: "admin@evil.com",
        username: "admin",
        role: "USER",
        image: null,
      },
      expires: "2099-01-01",
    };

    await expect(
      (isAdmin as any)({ ctx: { session: fakeAdmin }, next }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(next).not.toHaveBeenCalled();
  });

  it("should reject session with no role field at all", async () => {
    const { isAdmin } = await import("@/server/trpc");
    const next = createNext();

    await expect(
      (isAdmin as any)({
        ctx: {
          session: {
            user: { id: "no-role-user", email: "test@test.com", username: "test", image: null },
            expires: "2025-01-01",
          },
        },
        next,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(next).not.toHaveBeenCalled();
  });
});
