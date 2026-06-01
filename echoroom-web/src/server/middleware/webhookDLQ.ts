import { redis } from "@/lib/redis";
import { createLogger } from "@/server/lib/logger";

const log = createLogger("webhook-dlq");

export const MAX_RETRIES = 5;
export const TTL = 7 * 24 * 60 * 60; // 7 days in seconds

export interface DLQEntry {
  eventId: string;
  eventType: string;
  payload: unknown;
  error: string;
  retryCount: number;
  lastAttempt: string;
}

/**
 * Push a failed webhook event to the dead letter queue for a given provider.
 * Stores the entry in a Redis list keyed by `dlq:{provider}`.
 * Gracefully degrades when Redis is unavailable (logs warning, no throw).
 */
export async function pushToDLQ(
  provider: string,
  eventId: string,
  eventType: string,
  payload: unknown,
  error: string,
): Promise<void> {
  if (!redis) {
    log.warn("Redis unavailable — cannot push to DLQ", { provider, eventId, eventType });
    return;
  }

  const key = `dlq:${provider}`;
  const entry: DLQEntry = {
    eventId,
    eventType,
    payload,
    error,
    retryCount: 0,
    lastAttempt: new Date().toISOString(),
  };

  try {
    await redis.lpush(key, JSON.stringify(entry));
    await redis.expire(key, TTL);
    log.info("Pushed to DLQ", { provider, eventId, eventType, retryCount: 0 });
  } catch (err) {
    log.error("Failed to push to DLQ", { provider, eventId, error: String(err) });
  }
}

/**
 * Retry all entries in the DLQ for a given provider.
 * Entries under MAX_RETRIES have their retryCount incremented and are kept.
 * Entries that have exceeded MAX_RETRIES are discarded.
 * Returns counts of retried and permanently failed entries.
 */
export async function retryDLQ(
  provider: string,
): Promise<{ retried: number; failed: number; total: number }> {
  if (!redis) {
    log.warn("Redis unavailable — cannot retry DLQ");
    return { retried: 0, failed: 0, total: 0 };
  }

  const key = `dlq:${provider}`;

  // Read all entries atomically
  const entries = await redis.lrange(key, 0, -1);
  if (!entries || entries.length === 0) {
    return { retried: 0, failed: 0, total: 0 };
  }

  // Clear the list — we'll re-push surviving entries
  await redis.del(key);

  let retried = 0;
  let failed = 0;

  for (const entryStr of entries) {
    try {
      const entry: DLQEntry = JSON.parse(entryStr as string);

      if (entry.retryCount >= MAX_RETRIES) {
        // Exceeded max retries — discard permanently
        failed++;
        log.warn("DLQ entry exceeded max retries, discarded", {
          provider,
          eventId: entry.eventId,
          eventType: entry.eventType,
          retryCount: entry.retryCount,
        });
        continue;
      }

      // Increment retry count and push back
      entry.retryCount += 1;
      entry.lastAttempt = new Date().toISOString();
      await redis.lpush(key, JSON.stringify(entry));
      retried++;
    } catch (err) {
      log.error("Failed to retry DLQ entry", { provider, error: String(err) });
      failed++;
    }
  }

  // Reset TTL on the queue
  if (retried > 0 || failed > 0) {
    await redis.expire(key, TTL).catch(() => {});
  }

  log.info("DLQ retry complete", { provider, retried, failed, total: entries.length });

  return { retried, failed, total: entries.length };
}
