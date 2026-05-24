import { posthog } from "@/lib/posthog";

interface TrackEventParams {
  event: string;
  userId?: string;
  properties?: Record<string, string | number | boolean | null>;
}

export function trackEvent({ event, userId, properties }: TrackEventParams) {
  if (!posthog) return;

  try {
    if (userId) {
      posthog.capture(event, {
        distinct_id: userId,
        ...properties,
      });
    } else {
      posthog.capture(event, {
        distinct_id: "anonymous",
        ...properties,
      });
    }
  } catch {
    // Analytics silently fail
  }
}

export function identifyUser(userId: string, traits?: Record<string, string | number | boolean>) {
  if (!posthog) return;

  try {
    posthog.identify(userId, traits as Record<string, unknown>);
  } catch {
    // Analytics silently fail
  }
}
