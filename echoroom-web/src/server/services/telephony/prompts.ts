export interface PromptCharacterData {
  name: string;
  description: string | null;
  promptSystem: string;
}

export interface PromptScenarioData {
  character: PromptCharacterData;
  aiInstructions: string;
  description: string | null;
}

export function buildSystemPrompt(scenario: PromptScenarioData): string {
  return [
    `Tu es ${scenario.character.name}. ${scenario.character.description || ""}`,
    scenario.character.promptSystem,
    scenario.aiInstructions,
    `Contexte du scénario: ${scenario.description || ""}`,
    "Réponds en français de manière naturelle et parlée, comme dans une conversation téléphonique.",
    "Garde tes réponses concises (2-3 phrases max) adaptées à un appel vocal.",
  ]
    .filter(Boolean)
    .join("\n");
}
