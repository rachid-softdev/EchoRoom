import { createLogger } from "@/server/lib/logger";
import { generateScript as generateScriptFromEngine } from "./conversationEngine";

const log = createLogger("generate-script");

export async function generateScenarioScript(params: {
  characterName: string;
  characterPrompt: string;
  title: string;
  description: string;
  openingMessage: string;
}): Promise<{
  suggestedOpening: string;
  suggestedResponses: string[];
}> {
  try {
    const openingResponse = await generateScriptFromEngine(
      params.characterPrompt,
      `Tu es ${params.characterName}. Tu appelles quelqu'un pour "${params.title}". Contexte : ${params.description}. Message d'ouverture proposé : "${params.openingMessage}". Génère une version améliorée et naturelle de ce message d'ouverture, comme si tu parlais au téléphone.`,
    );

    const responsesPrompt = `Tu génères des réponses suggérées pour l'utilisateur qui parle avec ${params.characterName}, un personnage avec la personnalité suivante : ${params.characterPrompt}. Le scénario est "${params.title}". Contexte : ${params.description}.

Génère 3 à 4 réponses courtes et naturelles que l'utilisateur pourrait dire dans cette conversation. Chaque réponse doit être cohérente avec la personnalité du personnage et le contexte du scénario. Retourne chaque réponse sur une ligne séparée commençant par "- ".`;

    const responsesRaw = await generateScriptFromEngine(
      params.characterPrompt,
      responsesPrompt,
    );

    const suggestedResponses = parseResponses(responsesRaw);

    return { suggestedOpening: openingResponse, suggestedResponses };
  } catch (error) {
    log.error("Failed to generate script", { error });
    return {
      suggestedOpening: generateDefaultOpening(params.characterName),
      suggestedResponses: generateDefaultResponses(),
    };
  }
}

function parseResponses(raw: string): string[] {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const responses: string[] = [];
  for (const line of lines) {
    // Strip common list prefixes: "- ", "* ", "1. ", "1) "
    const cleaned = line.replace(/^[-*]\s*/, "").replace(/^\d+[\.\)]\s*/, "").trim();
    if (cleaned.length > 0) {
      responses.push(cleaned);
    }
  }

  // Ensure we always return at least 2 responses
  return responses.length >= 2 ? responses : generateDefaultResponses();
}

function generateDefaultOpening(characterName: string): string {
  return `Bonjour, ici ${characterName}. Je vous appelle suite à votre demande.`;
}

function generateDefaultResponses(): string[] {
  return [
    "Hmm, intéressant... Dis-m'en plus.",
    "Ah, je vois. Et donc tu penses que... ?",
    "(Rire) Attends, attends, répète ça ?",
  ];
}
