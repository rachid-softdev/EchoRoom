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
 *
 * NOTE: this function both *checks and consumes* the marker in a single call.
 * For handlers that write to the database, prefer the split `isEventProcessed`
 * / `markEventProcessed` pair (outbox pattern) so the marker is only consumed
 * after the DB write has committed — see `route.ts`.
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

/**
 * Read-only idempotency probe (does NOT consume the marker).
 *
 * Returns `true` when the event marker is already set, `false` otherwise.
 * Use this at the top of a handler to short-circuit already-processed events
 * without consuming the marker — the actual consumption must happen only after
 * the DB writes have committed (`markEventProcessed`), otherwise a DB failure
 * would permanently skip the event on retry (lost credits/plan).
 */
export async function isEventProcessed(eventId: string): Promise<boolean> {
  if (!redis) {
    log.warn("Redis unavailable — idempotency probe skipped for event", { eventId });
    return false;
  }

  try {
    const key = `${KEY_PREFIX}${eventId}`;
    const value = await redis.get(key);
    return value !== null;
  } catch (error) {
    log.error("Idempotency probe failed, allowing processing", { eventId, error });
    return false;
  }
}

/**
 * Consumes the idempotency marker for an event (SET NX with 24h TTL).
 *
 * Must be called only AFTER the handler's DB writes have committed
 * successfully, implementing the outbox pattern. If Redis is unavailable or
 * the write fails, downstream DB constraints (unique indexes, upserts) still
 * protect against duplicate application on retry.
 */
export async function markEventProcessed(eventId: string): Promise<void> {
  if (!redis) {
    log.warn("Redis unavailable — idempotency marker not recorded", { eventId });
    return;
  }

  try {
    const key = `${KEY_PREFIX}${eventId}`;
    await redis.set(key, "1", {
      nx: true,
      ex: IDEMPOTENCY_TTL_SECONDS,
    });
  } catch (error) {
    log.error("Idempotency mark failed, event may be reprocessed", { eventId, error });
  }
}
