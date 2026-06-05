import { middleware } from "../trpc";
import { createLogger } from "@/server/lib/logger";
import { trackEvent } from "@/server/services/analytics/events";

const log = createLogger("metrics");

interface EndpointCounters {
  calls: number;
  errors: number;
  totalDurationMs: number;
}

const metricsMap = new Map<string, EndpointCounters>();

const MAX_METRICS_ENTRIES = 1000;

/** tRPC middleware that collects RED (Rate/Errors/Duration) metrics. */
export const withREDMetrics = middleware(async ({ ctx, next, path, type }) => {
  const start = performance.now();

  try {
    const result = await next();

    const durationMs = Math.round(performance.now() - start);
    const endpoint = `${type}:${path}`;

    // Update in-memory counters
    updateCounters(endpoint, durationMs, false);

    // Fire-and-forget PostHog tracking
    const userId = ctx.session?.user?.id;
    trackEvent({
      event: "trpc_request",
      ...(userId ? { userId } : {}),
      properties: {
        endpoint: path,
        type,
        durationMs,
        status: "success",
      },
    }).catch(() => {});

    log.info("TRPC request", { endpoint, durationMs, status: "success", userId });

    return result;
  } catch (error) {
    const durationMs = Math.round(performance.now() - start);
    const endpoint = `${type}:${path}`;

    // Update in-memory counters
    updateCounters(endpoint, durationMs, true);

    // Fire-and-forget PostHog tracking
    const userId = ctx.session?.user?.id;
    trackEvent({
      event: "trpc_request",
      ...(userId ? { userId } : {}),
      properties: {
        endpoint: path,
        type,
        durationMs,
        status: "error",
      },
    }).catch(() => {});

    log.info("TRPC request", { endpoint, durationMs, status: "error", userId });

    // Re-throw — middleware does NOT swallow errors
    throw error;
  }
});

function updateCounters(endpoint: string, durationMs: number, isError: boolean): void {
  // Prevent unbounded memory growth
  if (metricsMap.size >= MAX_METRICS_ENTRIES && !metricsMap.has(endpoint)) {
    // Remove a random entry to make room
    const firstKey = metricsMap.keys().next();
    if (firstKey.value) {
      metricsMap.delete(firstKey.value);
    }
  }

  const counters = metricsMap.get(endpoint) ?? { calls: 0, errors: 0, totalDurationMs: 0 };
  counters.calls++;
  counters.totalDurationMs += durationMs;
  if (isError) counters.errors++;
  metricsMap.set(endpoint, counters);
}

export function getREDMetrics(): Record<string, EndpointCounters> {
  const snapshot: Record<string, EndpointCounters> = {};
  for (const [key, value] of metricsMap.entries()) {
    snapshot[key] = { ...value };
  }
  return snapshot;
}
