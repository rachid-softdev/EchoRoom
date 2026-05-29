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
  /nu(e)?/i,
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
  /0[1-9]\d{8}/,  // French phone numbers
  /\+33[1-9]\d{8}/, // International French numbers

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

export async function checkContent(
  text: string,
): Promise<ModerationResult> {
  // Step 1: Blocklist check
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(text)) {
      return {
        approved: false,
        reason: "Contenu interdit détecté (mot-clé bloqué)",
      };
    }
  }

  // Step 2: AI-based check if OpenAI is available
  if (openai) {
    try {
      const response = await openai.moderations.create({
        model: "omni-moderation-latest",
        input: text,
      });

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
      log.warn("AI moderation call failed, falling back to blocklist");
    }
  }

  return { approved: true };
}
