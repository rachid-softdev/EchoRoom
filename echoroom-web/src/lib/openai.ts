import OpenAI from "openai";
import { env } from "@/lib/env";
import { createLogger } from "@/server/lib/logger";
import { getRequestId } from "@/server/lib/requestContext";

const log = createLogger("openai");

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI | null {
  if (client) return client;
  try {
    client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      timeout: 30000,
      maxRetries: 2,
    });
    // Use a getter so X-Request-Id is evaluated per-request rather than at init time
    Object.defineProperty(client, "defaultHeaders", {
      get() {
        return { "X-Request-Id": getRequestId() };
      },
      configurable: true,
      enumerable: true,
    });
  } catch {
    log.warn("OpenAI client initialization failed — AI features disabled");
  }
  return client;
}
