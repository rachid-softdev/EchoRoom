import { redis } from "@/lib/redis";
import { createLogger } from "@/server/lib/logger";

const log = createLogger("webhook-idempotency");

const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24; // 24 hours
const KEY_PREFIX = "idempotency:stripe:";

/**
 * Checks whether a Stripe event has already been processed (idempotency check).
 *
 * Uses Redis atomic SET with NX (not exists) to ensure exactly one webhook
 * handler processes each event. Returns `true` if the event was already
 * processed, `false` if this is the first time seeing it.
 *
 * Graceful degradation: if Redis is unavailable, returns `false` (allow
 * processing) and logs a warning. Downstream idempotency constraints in the
 * database (unique indexes, updateMany guards) still protect against duplicates.
 */
export async function checkIdempotency(eventId: string): Promise<boolean> {
  if (!redis) {
    log.warn("Redis unavailable — idempotency check skipped for event", { eventId });
    return false;
  }

  try {
    const key = `${KEY_PREFIX}${eventId}`;
    const set = await redis.set(key, "1", {
      nx: true,
      ex: IDEMPOTENCY_TTL_SECONDS,
    });

    // If SET NX returns null, the key already existed — event was processed
    if (set === null) {
      log.info("Duplicate webhook event detected, skipping", { eventId });
      return true;
    }

    return false;
  } catch (error) {
    log.error("Idempotency check failed, allowing processing", { eventId, error });
    return false;
  }
}
