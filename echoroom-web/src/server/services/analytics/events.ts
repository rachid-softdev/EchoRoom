import { posthog } from "@/lib/posthog-server";

interface TrackEventParams {
  event: string;
  userId?: string;
  properties?: Record<string, string | number | boolean | null>;
}

export function trackEvent({ event, userId, properties }: TrackEventParams) {
  if (!posthog) return;

  try {
    posthog.capture({
      distinctId: userId ?? "anonymous",
      event,
      properties: properties ?? {},
    });
  } catch {
    // Analytics silently fail
  }
}

export function identifyUser(userId: string, traits?: Record<string, string | number | boolean>) {
  if (!posthog) return;

  try {
    posthog.identify({
      distinctId: userId,
      properties: traits ?? {},
    });
  } catch {
    // Analytics silently fail
  }
}
