import { redis } from "@/lib/redis";
import { scenarioRepository } from "@/server/repositories";
import { decryptPhoneNumber, encryptPhoneNumber } from "@/server/lib/encryption";
import { createLogger } from "@/server/lib/logger";
import { CONVERSATION_TTL_S } from "./constants";
import { buildSystemPrompt } from "@/server/services/telephony/prompts";

const log = createLogger("conversation-state");

export interface ConversationMessage {
  role: "system" | "assistant" | "user";
  content: string;
}

export interface ConversationState {
  callSid: string;
  callId: string; // DB UUID of the Call record
  scenarioId: string;
  characterId: string;
  callerNumber: string;
  messages: ConversationMessage[]; // NEVER contains role: 'system'
  systemPrompt?: string; // Stored separately for prompt injection defense
  turnCount: number;
  lastActiveAt: string;
  status: "active" | "completed" | "timed_out" | "failed";
}

type InitData = Omit<ConversationState, "turnCount" | "lastActiveAt" | "status">;

function redisKey(callSid: string): string {
  return `conversation:${callSid}`;
}

export async function initConversationState(
  callSid: string,
  data: InitData,
): Promise<ConversationState | null> {
  if (!redis) return null;

  const state: ConversationState = {
    ...data,
    callerNumber: data.callerNumber ? encryptPhoneNumber(data.callerNumber) : "",
    turnCount: 0,
    lastActiveAt: new Date().toISOString(),
    status: "active",
  };

  try {
    await redis.set(redisKey(callSid), JSON.stringify(state), {
      ex: CONVERSATION_TTL_S,
    });
    return state;
  } catch (error) {
    log.error("Redis initConversationState error", { error });
    return null;
  }
}

export async function getConversationState(callSid: string): Promise<ConversationState | null> {
  if (!redis) return null;

  try {
    const raw = await redis.get<string>(redisKey(callSid));
    if (!raw) return null;

    const state: ConversationState = JSON.parse(raw);

    // Refresh TTL on access
    await redis.expire(redisKey(callSid), CONVERSATION_TTL_S).catch(() => {});

    return state;
  } catch (error) {
    log.error("Redis getConversationState error", { error });
    return null;
  }
}

export async function appendMessage(
  callSid: string,
  message: ConversationMessage,
): Promise<ConversationState | null> {
  if (!redis) return null;

  try {
    const state = await getConversationState(callSid);
    if (!state) return null;

    state.messages.push(message);
    state.lastActiveAt = new Date().toISOString();

    await redis.set(redisKey(callSid), JSON.stringify(state), {
      ex: CONVERSATION_TTL_S,
    });

    return state;
  } catch (error) {
    log.error("Redis appendMessage error", { error });
    return null;
  }
}

export async function incrementTurn(callSid: string): Promise<ConversationState | null> {
  if (!redis) return null;

  try {
    const state = await getConversationState(callSid);
    if (!state) return null;

    state.turnCount += 1;
    state.lastActiveAt = new Date().toISOString();

    await redis.set(redisKey(callSid), JSON.stringify(state), {
      ex: CONVERSATION_TTL_S,
    });

    return state;
  } catch (error) {
    log.error("Redis incrementTurn error", { error });
    return null;
  }
}

export async function setConversationStatus(
  callSid: string,
  status: ConversationState["status"],
): Promise<ConversationState | null> {
  if (!redis) return null;

  try {
    const state = await getConversationState(callSid);
    if (!state) return null;

    state.status = status;
    state.lastActiveAt = new Date().toISOString();

    await redis.set(redisKey(callSid), JSON.stringify(state), {
      ex: CONVERSATION_TTL_S,
    });

    return state;
  } catch (error) {
    log.error("Redis setConversationStatus error", { error });
    return null;
  }
}

export async function deleteConversationState(callSid: string): Promise<void> {
  if (!redis) return;

  try {
    await redis.del(redisKey(callSid));
  } catch (error) {
    log.error("Redis deleteConversationState error", { error });
  }
}

/**
 * Retrieve and decrypt the caller's phone number from conversation state.
 * Handles both encrypted (v1 format) and legacy plaintext formats
 * for the short window during deployment transition.
 */
export async function getCallerNumber(callSid: string): Promise<string | null> {
  const state = await getConversationState(callSid);
  if (!state?.callerNumber) return null;
  try {
    return decryptPhoneNumber(state.callerNumber);
  } catch {
    // Legacy plaintext or not yet encrypted — return as-is
    return state.callerNumber;
  }
}

/**
 * Returns the DB call ID from the conversation state.
 * Falls back to callSid for conversations initiated before callId was added.
 */
export function getCallId(state: ConversationState): string {
  return state.callId || state.callSid;
}

/**
 * Retrieve the system prompt from conversation state.
 * For NEW conversations, reads from the dedicated systemPrompt field.
 * For LEGACY conversations (before this deploy), reads from messages array.
 * If neither has a system prompt, falls back to querying the database.
 *
 * @returns The system prompt string, or a safe default if not found.
 */
export async function getSystemPromptFromState(state: ConversationState): Promise<string> {
  // New format: dedicated systemPrompt field
  if (state.systemPrompt) return state.systemPrompt;

  // Legacy format: system message in messages array
  const systemMessage = state.messages.find((m) => m.role === "system");
  if (systemMessage) return systemMessage.content;

  // Fallback: try to load from database using scenarioId
  if (state.scenarioId && state.scenarioId !== "unknown") {
    try {
      const scenario = await scenarioRepository.findByIdWithCharacter(state.scenarioId);
      if (scenario) {
        return buildSystemPrompt(scenario);
      }
    } catch (error) {
      log.error("Failed to load scenario for system prompt", { error });
    }
  }

  // Ultimate fallback
  return "Tu es un assistant IA amical. Réponds en français de manière naturelle.";
}
