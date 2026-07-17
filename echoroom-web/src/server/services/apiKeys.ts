import { createHash, randomBytes } from "node:crypto";
import { db } from "@/server/db";
import { createLogger } from "@/server/lib/logger";

const log = createLogger("apiKeys");

/** Human-readable prefix shown in the UI for every issued key. */
const API_KEY_PREFIX = "ek_live_";

export interface GeneratedApiKey {
  id: string;
  name: string;
  /** Plaintext key — returned ONLY here, once. Never persisted. */
  key: string;
  prefix: string;
}

export interface ApiKeySummary {
  id: string;
  name: string;
  prefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

/**
 * Generates a new API key for the user.
 *
 * The plaintext key is returned EXACTLY ONCE here and is never persisted — only
 * a SHA-256 hash (`keyHash`) and the human-readable `prefix` are stored. Callers
 * must surface the returned `key` to the end user immediately (e.g. in the
 * creation response), because it cannot be recovered later.
 */
export async function generateApiKey(
  userId: string,
  name: string,
): Promise<GeneratedApiKey> {
  const random = randomBytes(24).toString("base64url");
  const plaintext = `${API_KEY_PREFIX}${random}`;
  const keyHash = createHash("sha256").update(plaintext).digest("hex");

  // Single creation wrapped in a transaction for atomicity / future-proofing.
  const created = await db.$transaction(async (tx) => {
    return tx.apiKey.create({
      data: { userId, name, keyHash, prefix: API_KEY_PREFIX },
      select: { id: true, name: true },
    });
  });

  log.info("API key created", { userId, keyId: created.id });

  return {
    id: created.id,
    name: created.name,
    key: plaintext,
    prefix: API_KEY_PREFIX,
  };
}

/**
 * Lists the caller's non-revoked API keys. The hash is NEVER returned — only the
 * human-readable `prefix` (used by the UI to help users identify a key).
 */
export async function listApiKeys(userId: string): Promise<ApiKeySummary[]> {
  return db.apiKey.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
    },
  });
}

/**
 * Revokes an API key. The `where` clause matches both `id` AND `userId`, so a
 * user can only ever revoke their own keys (cross-user revocation is impossible
 * even if a malicious `id` is supplied). Idempotent for already-revoked keys.
 */
export async function revokeApiKey(userId: string, id: string): Promise<void> {
  await db.apiKey.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Validates a presented plaintext API key (for future REST auth).
 *
 * Hashes the plaintext and looks it up by `keyHash`. Returns the owning
 * `userId` when the key exists and is not revoked; otherwise `null`. On success
 * it touches `lastUsedAt` for active-key analytics / auditing.
 */
export async function validateApiKey(
  plaintext: string,
): Promise<{ userId: string } | null> {
  const keyHash = createHash("sha256").update(plaintext).digest("hex");
  const apiKey = await db.apiKey.findUnique({
    where: { keyHash },
    select: { userId: true, revokedAt: true },
  });

  if (!apiKey || apiKey.revokedAt !== null) {
    return null;
  }

  // Touch lastUsedAt (best-effort; never fails validation).
  await db.apiKey.update({
    where: { keyHash },
    data: { lastUsedAt: new Date() },
    select: { id: true },
  });

  return { userId: apiKey.userId };
}
