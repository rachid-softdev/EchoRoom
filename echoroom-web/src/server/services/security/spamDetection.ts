import crypto from "node:crypto";
import { redis } from "@/lib/redis";
import { createLogger } from "@/server/lib/logger";

const log = createLogger("spam-detection");

export interface SpamResult {
  flagged: boolean;
  reason?: string;
}

/**
 * Detect call spam: 5+ calls to the same number in 1 hour.
 * Returns flagged=true when the threshold is exceeded.
 */
export async function detectCallSpam(userId: string, phoneNumber: string): Promise<SpamResult> {
  if (!redis) return { flagged: false };

  try {
    const key = `spam:call:${userId}:${phoneNumber}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 3600); // 1 hour window
    }
    if (count >= 5) {
      log.warn("Call spam detected", { userId, phoneNumber, count });
      return {
        flagged: true,
        reason: "Trop d'appels vers ce numéro. Réessayez plus tard.",
      };
    }
    return { flagged: false };
  } catch (error) {
    log.error("Spam detection failed (call)", { userId, error });
    return { flagged: false }; // Graceful degradation
  }
}

/**
 * Detect scenario creation spam: 10+ scenarios in 5 minutes.
 */
export async function detectScenarioSpam(userId: string): Promise<SpamResult> {
  if (!redis) return { flagged: false };

  try {
    const key = `spam:scenario:${userId}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 300); // 5 minute window
    }
    if (count >= 10) {
      log.warn("Scenario spam detected", { userId, count });
      return {
        flagged: true,
        reason: "Trop de scénarios créés. Réessayez plus tard.",
      };
    }
    return { flagged: false };
  } catch (error) {
    log.error("Spam detection failed (scenario)", { userId, error });
    return { flagged: false };
  }
}

/**
 * Detect comment spam: same text posted 5+ times in 1 hour.
 * Uses a hash of the content as part of the Redis key.
 */
export async function detectCommentSpam(userId: string, content: string): Promise<SpamResult> {
  if (!redis) return { flagged: false };

  try {
    // SHA-256 hash of the content for the Redis key
    const hash = contentHash(content.trim().toLowerCase());
    const key = `spam:comment:${userId}:${hash}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 3600); // 1 hour window
    }
    if (count >= 5) {
      log.warn("Comment spam detected", { userId, contentHash, count });
      return {
        flagged: true,
        reason: "Commentaire détecté comme spam. Réessayez plus tard.",
      };
    }
    return { flagged: false };
  } catch (error) {
    log.error("Spam detection failed (comment)", { userId, error });
    return { flagged: false };
  }
}

/**
 * SHA-256 hash for creating Redis keys from content.
 * Truncated to 16 hex chars to avoid excessively long keys.
 */
function contentHash(str: string): string {
  return crypto.createHash("sha256").update(str).digest("hex").substring(0, 16);
}
