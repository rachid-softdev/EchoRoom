import { generateScript as generateScriptFromEngine } from "./conversationEngine";

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
  const openingResponse = await generateScriptFromEngine(
    params.characterPrompt,
    `Tu es ${params.characterName}. Tu appelles quelqu'un pour "${params.title}". Contexte : ${params.description}. Message d'ouverture proposé : "${params.openingMessage}". Génère une version améliorée et naturelle de ce message d'ouverture, comme si tu parlais au téléphone.`,
  );

  return {
    suggestedOpening: openingResponse,
    suggestedResponses: [
      "Hmm, intéressant... Dis-m'en plus.",
      "Ah, je vois. Et donc tu penses que... ?",
      "(Rire) Attends, attends, répète ça ?",
    ],
  };
}
