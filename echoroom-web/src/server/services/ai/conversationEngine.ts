import OpenAI from "openai";
import { env } from "@/lib/env";
import { createLogger } from "@/server/lib/logger";

const log = createLogger("conversation-engine");

let openai: OpenAI | null = null;

try {
  openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
} catch {
  log.warn("OpenAI unavailable — conversation engine disabled");
}

interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ConversationEngineOptions {
  systemPrompt: string;
  messages: ConversationMessage[];
  maxTokens?: number;
}

interface ConversationEngineResult {
  response: string;
  tokensUsed: number;
}

export async function generateResponse(
  options: ConversationEngineOptions,
): Promise<ConversationEngineResult> {
  if (!openai) {
    return {
      response:
        "Désolé, le moteur de conversation n'est pas disponible actuellement.",
      tokensUsed: 0,
    };
  }

  const allMessages: ConversationMessage[] = [
    { role: "system", content: options.systemPrompt },
    ...options.messages,
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: allMessages,
    max_tokens: options.maxTokens ?? 300,
    temperature: 0.8,
  });

  const response =
    completion.choices[0]?.message?.content ??
    "Je n'ai rien à dire...";

  return {
    response,
    tokensUsed: completion.usage?.total_tokens ?? 0,
  };
}

export { detectGoodbye } from '../telephony/goodbyeDetector'

export async function generateScript(
  characterPrompt: string,
  userInput: string,
): Promise<string> {
  if (!openai) {
    return "Moteur IA indisponible.";
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Tu génères une réplique pour un personnage IA. ${characterPrompt}. Réponds en français, de manière naturelle et parlée.`,
      },
      {
        role: "user",
        content: userInput,
      },
    ],
    max_tokens: 200,
    temperature: 0.9,
  });

  return completion.choices[0]?.message?.content ?? "...";
}
