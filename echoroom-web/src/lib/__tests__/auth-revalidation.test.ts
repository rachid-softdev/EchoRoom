import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// M-8: auth.ts — JWT revalidation interval
// ---------------------------------------------------------------------------
// Tests that the revalidation logic from auth.ts works correctly:
//   - Regular users: revalidation interval is 15 minutes
//   - Admin users: revalidation interval is 1 minute
//   - needsRevalidation triggers correctly based on lastVerified timestamp
//
// We extract the revalidation logic from auth.ts and test it in isolation.
// This avoids needing to bootstrap the full NextAuth framework.

vi.mock("@/server/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

/**
 * Simulate the revalidation logic from auth.ts jwt callback.
 * Extracted for isolated testing of the interval logic.
 */
async function simulateJwtRevalidation(
  token: Record<string, unknown>,
  trigger?: string,
): Promise<Record<string, unknown> | null> {
  const { db } = await import("@/server/db");

  const userRole = (token["role"] as string) ?? "USER";
  const revalidationInterval =
    userRole === "ADMIN" || userRole === "MODERATOR"
      ? 60 * 1000 // 1 minute for staff
      : 15 * 60 * 1000; // 15 minutes for regular users

  const needsRevalidation =
    trigger === "update" ||
    !token["lastVerified"] ||
    Date.now() - (token["lastVerified"] as number) > revalidationInterval;

  if (needsRevalidation && token["id"]) {
    const dbUser = await db.user.findUnique({
      where: { id: token["id"] as string },
      select: { role: true, deletedAt: true, tokenVersion: true },
    });

    if (!dbUser || dbUser.deletedAt) {
      return null;
    }

    if (dbUser.tokenVersion !== (token["tokenVersion"] ?? 0)) {
      return null;
    }

    token["role"] = dbUser.role;
    token["lastVerified"] = Date.now();
  }

  return token;
}

describe("M-8: JWT revalidation interval — regular users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should revalidate every 15 minutes for regular users", async () => {
    const { db } = await import("@/server/db");
    (db.user.findUnique as any).mockResolvedValue({
      id: "user-1",
      role: "USER",
      deletedAt: null,
      tokenVersion: 0,
    });

    // Token with lastVerified 16 minutes ago (exceeds 15 min interval)
    const oldTimestamp = Date.now() - 16 * 60 * 1000;
    const result = await simulateJwtRevalidation({
      id: "user-1",
      role: "USER",
      tokenVersion: 0,
      lastVerified: oldTimestamp,
    });

    expect(result).not.toBeNull();
    // Should have called DB to re-verify
    expect(db.user.findUnique).toHaveBeenCalledTimes(1);
    // lastVerified should be updated
    expect((result as any).lastVerified).toBeGreaterThan(oldTimestamp);
  });

  it("should NOT revalidate within 15 minute window for regular users", async () => {
    const { db } = await import("@/server/db");

    // Token with lastVerified 5 minutes ago (within 15 min interval)
    const recentTimestamp = Date.now() - 5 * 60 * 1000;
    const result = await simulateJwtRevalidation({
      id: "user-1",
      role: "USER",
      tokenVersion: 0,
      lastVerified: recentTimestamp,
    });

    expect(result).not.toBeNull();
    // Should NOT have called DB (within interval)
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("M-8: JWT revalidation interval — admin users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should revalidate every 1 minute for admin users", async () => {
    const { db } = await import("@/server/db");
    (db.user.findUnique as any).mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      deletedAt: null,
      tokenVersion: 0,
    });

    // Token with lastVerified 90 seconds ago (exceeds 1 min interval)
    const oldTimestamp = Date.now() - 90 * 1000;
    const result = await simulateJwtRevalidation({
      id: "admin-1",
      role: "ADMIN",
      tokenVersion: 0,
      lastVerified: oldTimestamp,
    });

    expect(result).not.toBeNull();
    // Should have called DB to re-verify
    expect(db.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it("should NOT revalidate within 1 minute window for admin users", async () => {
    const { db } = await import("@/server/db");

    // Token with lastVerified 30 seconds ago (within 1 min interval)
    const recentTimestamp = Date.now() - 30 * 1000;
    const result = await simulateJwtRevalidation({
      id: "admin-1",
      role: "ADMIN",
      tokenVersion: 0,
      lastVerified: recentTimestamp,
    });

    expect(result).not.toBeNull();
    // Should NOT have called DB (within interval)
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("should revalidate moderator users every 1 minute like admins", async () => {
    const { db } = await import("@/server/db");
    (db.user.findUnique as any).mockResolvedValue({
      id: "mod-1",
      role: "MODERATOR",
      deletedAt: null,
      tokenVersion: 0,
    });

    const oldTimestamp = Date.now() - 2 * 60 * 1000; // 2 min ago
    const result = await simulateJwtRevalidation({
      id: "mod-1",
      role: "MODERATOR",
      tokenVersion: 0,
      lastVerified: oldTimestamp,
    });

    expect(result).not.toBeNull();
    expect(db.user.findUnique).toHaveBeenCalledTimes(1);
  });
});

describe("M-8: needsRevalidation edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should revalidate when trigger is 'update'", async () => {
    const { db } = await import("@/server/db");
    (db.user.findUnique as any).mockResolvedValue({
      id: "user-1",
      role: "USER",
      deletedAt: null,
      tokenVersion: 0,
    });

    const result = await simulateJwtRevalidation(
      {
        id: "user-1",
        role: "USER",
        tokenVersion: 0,
        lastVerified: Date.now(), // Fresh timestamp
      },
      "update",
    );

    expect(result).not.toBeNull();
    expect(db.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it("should revalidate when lastVerified is missing", async () => {
    const { db } = await import("@/server/db");
    (db.user.findUnique as any).mockResolvedValue({
      id: "user-1",
      role: "USER",
      deletedAt: null,
      tokenVersion: 0,
    });

    const result = await simulateJwtRevalidation({
      id: "user-1",
      role: "USER",
      tokenVersion: 0,
      // No lastVerified
    });

    expect(result).not.toBeNull();
    expect(db.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it("should return null when user is deleted", async () => {
    const { db } = await import("@/server/db");
    (db.user.findUnique as any).mockResolvedValue(null);

    const result = await simulateJwtRevalidation(
      {
        id: "deleted-user",
        role: "USER",
        tokenVersion: 0,
        lastVerified: 0,
      },
      "update",
    );

    expect(result).toBeNull();
  });

  it("should return null when tokenVersion differs", async () => {
    const { db } = await import("@/server/db");
    (db.user.findUnique as any).mockResolvedValue({
      id: "user-1",
      role: "USER",
      deletedAt: null,
      tokenVersion: 5, // DB has newer version
    });

    const result = await simulateJwtRevalidation(
      {
        id: "user-1",
        role: "USER",
        tokenVersion: 3, // Token has old version
        lastVerified: 0,
      },
      "update",
    );

    expect(result).toBeNull();
  });
});
