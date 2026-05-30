import OpenAI from "openai";
import { env } from "@/lib/env";
import { createLogger } from "@/server/lib/logger";

const log = createLogger("moderation");

let openai: OpenAI | null = null;

try {
  openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
} catch {
  log.warn("OpenAI unavailable — moderation disabled");
}

const forbiddenPatterns = [
  /celebrity/i,
  /célébrité/i,
  /famous/i,
  /politic/i,
  /président/i,
  /president/i,
  /election/i,
  /élection/i,
  /nazi/i,
  /hitler/i,
  /trump/i,
  /biden/i,
  /musk/i,
  /sex/i,
  /porn/i,
  /nsfw/i,
  /nude/i,
  /\bnue?\b/i,         // Fixed: removed capturing group, added \b (was /nu(e)?/i — ReDoS + false positive)
  /escort/i,
  /prostitut/i,
  /scam/i,
  /arnaque/i,
  /phishing/i,
  /harass/i,
  /harcèl/i,
  /harcèle/i,
  /suicid/i,
  /kill/i,
  /tuer/i,
  /murder/i,
  /weapon/i,
  /arme/i,
  /drug/i,
  /drogue/i,
  /cocaïne/i,
  /heroin/i,
  /deepfake/i,

  // Merged from deprecated middleware/moderation.ts
  /va te faire/i,
  /fils de pute/i,
  /enculé/i,
  /bâtard/i,
  /connard/i,
  /salaud/i,
  /putain/i,
  /merde/i,
  /nique/i,
  /\b0[1-9]\d{8}\b/,   // Fixed: added \b word boundaries (was without)
  /(?<!\d)\+33[1-9]\d{8}\b/, // Fixed: added \b word boundaries, (?<!\d) for + (was without)

  // Celebrity names
  /miley cyrus/i,
  /taylor swift/i,
  /kanye west/i,
  /jeff bezos/i,
  /mark zuckerberg/i,
];

interface ModerationResult {
  approved: boolean;
  reason?: string;
}

// Maximum input length for content moderation (characters).
// Prevents DoS via CPU-exhaustion from regex on massive inputs
// and avoids excessive OpenAI API costs from character-based billing.
const MAX_MODERATION_INPUT_LENGTH = 10_000;

export async function checkContent(
  text: string,
  signal?: AbortSignal,
): Promise<ModerationResult> {
  // Normalisation Unicode NFKC — empêche les homoglyphes
  // Also truncate to MAX_MODERATION_INPUT_LENGTH to prevent resource exhaustion
  const normalized = text.normalize("NFKC").substring(0, MAX_MODERATION_INPUT_LENGTH);

  // Step 1: Blocklist check (sur le texte normalisé)
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(normalized)) {
      return {
        approved: false,
        reason: "Contenu interdit détecté (mot-clé bloqué)",
      };
    }
  }

  // Step 2: AI-based check if OpenAI is available
  if (openai) {
    try {
      const response = await openai.moderations.create(
        {
          model: "omni-moderation-latest",
          input: normalized,
        },
        { signal },
      );

      const result = response.results[0];
      if (result?.flagged) {
        const flaggedCategories = Object.entries(result.categories)
          .filter(([, flagged]) => flagged)
          .map(([category]) => category);

        return {
          approved: false,
          reason: `Contenu refusé par modération IA : ${flaggedCategories.join(", ")}`,
        };
      }
    } catch {
      // If AI moderation fails, fall back to blocklist-only
      log.warn("AI moderation call failed — falling back to blocklist");
      // In production, this should trigger an alert
      if (process.env.NODE_ENV === "production") {
        console.error("[ALERT] OpenAI moderation unavailable!");
      }
    }
  }

  return { approved: true };
}

/**
 * Moderate AI-generated output with a configurable timeout.
 * On timeout, content is allowed through (fail-open for call continuity).
 * Blocked content is logged for audit/review.
 */
export async function moderateOutput(
  text: string,
  timeoutMs: number = 2000,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await checkContent(text, controller.signal);
    if (!result.approved) {
      log.warn("AI-generated content blocked", { reason: result.reason, contentLength: text.length });
      return "Je ne peux pas répondre à cela. Passons à autre chose.";
    }
    return text;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      log.warn("Moderation timed out — allowing content through", { contentLength: text.length });
      return text; // Fail-open for safety (better than no response on a call)
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
