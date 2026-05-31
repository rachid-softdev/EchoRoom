import OpenAI from "openai";
import { env } from "@/lib/env";
import { createLogger } from "@/server/lib/logger";

const log = createLogger("openai");

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI | null {
  if (client) return client;
  try {
    client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  } catch {
    log.warn("OpenAI client initialization failed — AI features disabled");
  }
  return client;
}
