import { PostHog } from "posthog-node";
import { env } from "./env";

let posthog: PostHog | null = null;

try {
  if (typeof window === "undefined") {
    posthog = new PostHog(env.POSTHOG_KEY, {
      host: env.POSTHOG_HOST,
    });
  }
} catch {
  // Analytics silently disabled
}

/**
 * Force-flush PostHog events.
 * Appelé après chaque événement en environnement serverless.
 */
async function flushPosthog(): Promise<void> {
  if (!posthog) return;
  try {
    await posthog.flush();
  } catch {
    // Analytics silently fail
  }
}

/**
 * Shutdown PostHog client (flush + release resources).
 */
async function shutdownPosthog(): Promise<void> {
  if (!posthog) return;
  try {
    await posthog.shutdown();
    posthog = null;
  } catch {
    // Analytics silently fail
  }
}

export { flushPosthog, posthog, shutdownPosthog };
