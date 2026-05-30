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

export { posthog };
