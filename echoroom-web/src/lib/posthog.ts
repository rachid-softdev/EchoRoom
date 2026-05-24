import posthogjs from "posthog-js";
import type { PostHog } from "posthog-js";
import { env } from "./env.client";

let posthog: PostHog | null = null;

try {
  if (typeof window !== "undefined") {
    posthogjs.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: env.NEXT_PUBLIC_POSTHOG_HOST,
    });
    posthog = posthogjs;
  }
} catch {
  // Analytics silently disabled
}

export { posthog };
