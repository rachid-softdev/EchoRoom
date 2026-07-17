import { PrismaClient } from "@prisma/client";
import { loadFlagOverridesFromDb } from "@/config/featureFlags";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

// Load persisted feature-flag overrides once at startup so overrides set via
// admin.setFeatureFlagOverride survive process restarts. isFeatureEnabled
// consults this cache, so without this call DB overrides are ignored after a
// reload (and config defaults are used instead).
let flagOverridesLoaded: Promise<void> | undefined;
export function ensureFeatureFlagOverridesLoaded(): Promise<void> {
  if (!flagOverridesLoaded) {
    flagOverridesLoaded = loadFlagOverridesFromDb()
      .then(() => undefined)
      .catch((err) => {
        // Non-fatal: flags fall back to config defaults until the DB is reachable.
        console.error("[featureFlags] failed to load DB overrides:", err);
      });
  }
  return flagOverridesLoaded;
}

// Skip DB-backed flag loading in the Edge runtime (Prisma unavailable there).
if (process.env.NEXT_RUNTIME !== "edge") {
  void ensureFeatureFlagOverridesLoaded();
}
