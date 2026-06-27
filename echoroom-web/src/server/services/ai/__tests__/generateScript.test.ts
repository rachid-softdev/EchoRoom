import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Generate Script Tests — generateScenarioScript, parseResponses
// ---------------------------------------------------------------------------

const mockLogInstance = {
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => mockLogInstance),
}));

// Mock conversationEngine.generateScript — module-level reference
const mockGenerateScript = vi.fn();
vi.mock("../conversationEngine", () => ({
  generateScript: mockGenerateScript,
}));

const defaultParams = {
  characterName: "Sophie",
  characterPrompt: "Tu es Sophie, une conseillère clientèle patiente et professionnelle.",
  title: "Service client",
  description: "Une cliente appelle car elle a un problème avec sa facture.",
  openingMessage: "Bonjour, vous avez besoin d'aide?",
};

describe("generateScenarioScript", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Fully reset mockGenerateScript to clear any lingering implementations
    // (avoid mockRejectedValue state leaking from previous tests)
    mockGenerateScript.mockReset();
  });

  // -----------------------------------------------------------------------
  // Happy path
  // -----------------------------------------------------------------------

  it("should return suggested opening and responses when AI succeeds", async () => {
    mockGenerateScript
      .mockResolvedValueOnce(
        "Bonjour et bienvenue chez EchoRoom, comment puis-je vous aider aujourd'hui?",
      )
      .mockResolvedValueOnce(
        [
          "J'ai un problème avec ma facture.",
          "Pouvez-vous m'expliquer les frais?",
          "Merci, c'est plus clair maintenant.",
        ]
          .map((r) => `- ${r}`)
          .join("\n"),
      );

    const { generateScenarioScript } = await import("../generateScript");
    const result = await generateScenarioScript(defaultParams);

    expect(result.suggestedOpening).toBe(
      "Bonjour et bienvenue chez EchoRoom, comment puis-je vous aider aujourd'hui?",
    );
    expect(result.suggestedResponses).toHaveLength(3);
    expect(result.suggestedResponses[0]).toBe("J'ai un problème avec ma facture.");
    expect(result.suggestedResponses[1]).toBe("Pouvez-vous m'expliquer les frais?");
    expect(result.suggestedResponses[2]).toBe("Merci, c'est plus clair maintenant.");
  });

  it("should call generateScript twice (opening + responses)", async () => {
    mockGenerateScript
      .mockResolvedValueOnce("Ouverture améliorée")
      .mockResolvedValueOnce("- Réponse 1\n- Réponse 2\n- Réponse 3");

    const { generateScenarioScript } = await import("../generateScript");
    await generateScenarioScript(defaultParams);

    expect(mockGenerateScript).toHaveBeenNthCalledWith(
      1,
      defaultParams.characterPrompt,
      expect.stringContaining("Génère une version améliorée et naturelle"),
    );

    expect(mockGenerateScript).toHaveBeenNthCalledWith(
      2,
      defaultParams.characterPrompt,
      expect.stringContaining("Génère 3 à 4 réponses"),
    );
  });

  // -----------------------------------------------------------------------
  // AI failure → fallback
  // -----------------------------------------------------------------------

  it("should return default opening and responses when AI throws", async () => {
    mockGenerateScript.mockRejectedValue(new Error("OpenAI API error"));

    const { generateScenarioScript } = await import("../generateScript");
    const result = await generateScenarioScript(defaultParams);

    expect(result.suggestedOpening).toBe(
      "Bonjour, ici Sophie. Je vous appelle suite à votre demande.",
    );
    expect(result.suggestedResponses).toEqual([
      "Hmm, intéressant... Dis-m'en plus.",
      "Ah, je vois. Et donc tu penses que... ?",
      "(Rire) Attends, attends, répète ça ?",
    ]);
  });

  it("should log error when AI generation fails", async () => {
    mockGenerateScript.mockRejectedValue(new Error("OpenAI API error"));

    const { generateScenarioScript } = await import("../generateScript");
    await generateScenarioScript(defaultParams);

    expect(mockLogInstance.error).toHaveBeenCalledWith(
      "Failed to generate script",
      expect.objectContaining({ error: expect.any(Error) }),
    );
  });

  it("should use fallback responses when second call (responses) fails", async () => {
    mockGenerateScript
      .mockResolvedValueOnce("Ouverture réussie")
      .mockRejectedValueOnce(new Error("Responses generation failed"));

    const { generateScenarioScript } = await import("../generateScript");
    const result = await generateScenarioScript(defaultParams);

    // Whole try block fails because second call rejects — both opening and responses fall back to defaults
    expect(result.suggestedOpening).toBe(
      "Bonjour, ici Sophie. Je vous appelle suite à votre demande.",
    );
    expect(result.suggestedResponses).toEqual([
      "Hmm, intéressant... Dis-m'en plus.",
      "Ah, je vois. Et donc tu penses que... ?",
      "(Rire) Attends, attends, répète ça ?",
    ]);
  });

  it("should return fallback when opening call throws even if responses would succeed", async () => {
    mockGenerateScript
      .mockRejectedValueOnce(new Error("Opening failed"))
      .mockResolvedValueOnce("- Réponse A\n- Réponse B\n- Réponse C");

    const { generateScenarioScript } = await import("../generateScript");
    const result = await generateScenarioScript(defaultParams);

    // Because opening threw, the whole try block jumps to catch
    expect(result.suggestedOpening).toBe(
      "Bonjour, ici Sophie. Je vous appelle suite à votre demande.",
    );
    expect(result.suggestedResponses).toEqual([
      "Hmm, intéressant... Dis-m'en plus.",
      "Ah, je vois. Et donc tu penses que... ?",
      "(Rire) Attends, attends, répète ça ?",
    ]);
  });
});

// ---------------------------------------------------------------------------
// parseResponses (internal function - tested through generateScenarioScript)
// ---------------------------------------------------------------------------

describe("parseResponses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateScript.mockReset();
  });

  it("should strip '- ' prefix from responses", async () => {
    mockGenerateScript
      .mockResolvedValueOnce("Opener")
      .mockResolvedValueOnce("- Première réponse\n- Deuxième réponse\n- Troisième réponse");

    const { generateScenarioScript } = await import("../generateScript");
    const result = await generateScenarioScript(defaultParams);

    expect(result.suggestedResponses).toEqual([
      "Première réponse",
      "Deuxième réponse",
      "Troisième réponse",
    ]);
  });

  it("should strip '* ' prefix from responses", async () => {
    mockGenerateScript
      .mockResolvedValueOnce("Opener")
      .mockResolvedValueOnce("* Réponse A\n* Réponse B\n* Réponse C");

    const { generateScenarioScript } = await import("../generateScript");
    const result = await generateScenarioScript(defaultParams);

    expect(result.suggestedResponses).toEqual(["Réponse A", "Réponse B", "Réponse C"]);
  });

  it("should strip '1. ' numbering prefix from responses", async () => {
    mockGenerateScript
      .mockResolvedValueOnce("Opener")
      .mockResolvedValueOnce("1. Premier point\n2. Deuxième point\n3. Troisième point");

    const { generateScenarioScript } = await import("../generateScript");
    const result = await generateScenarioScript(defaultParams);

    expect(result.suggestedResponses).toEqual([
      "Premier point",
      "Deuxième point",
      "Troisième point",
    ]);
  });

  it("should strip '1) ' parenthesis numbering from responses", async () => {
    mockGenerateScript
      .mockResolvedValueOnce("Opener")
      .mockResolvedValueOnce("1) Option un\n2) Option deux\n3) Option trois");

    const { generateScenarioScript } = await import("../generateScript");
    const result = await generateScenarioScript(defaultParams);

    expect(result.suggestedResponses).toEqual(["Option un", "Option deux", "Option trois"]);
  });

  it("should ignore empty lines between responses", async () => {
    mockGenerateScript
      .mockResolvedValueOnce("Opener")
      .mockResolvedValueOnce("- Réponse 1\n\n- Réponse 2\n\n\n- Réponse 3");

    const { generateScenarioScript } = await import("../generateScript");
    const result = await generateScenarioScript(defaultParams);

    expect(result.suggestedResponses).toEqual(["Réponse 1", "Réponse 2", "Réponse 3"]);
  });

  it("should return fallback when fewer than 2 responses are parsed", async () => {
    mockGenerateScript
      .mockResolvedValueOnce("Opener")
      .mockResolvedValueOnce("- Seulement une réponse");

    const { generateScenarioScript } = await import("../generateScript");
    const result = await generateScenarioScript(defaultParams);

    expect(result.suggestedResponses).toEqual([
      "Hmm, intéressant... Dis-m'en plus.",
      "Ah, je vois. Et donc tu penses que... ?",
      "(Rire) Attends, attends, répète ça ?",
    ]);
  });

  it("should return fallback when 0 responses are parsed (all empty lines)", async () => {
    mockGenerateScript.mockResolvedValueOnce("Opener").mockResolvedValueOnce("   \n\n  \n   ");

    const { generateScenarioScript } = await import("../generateScript");
    const result = await generateScenarioScript(defaultParams);

    expect(result.suggestedResponses).toEqual([
      "Hmm, intéressant... Dis-m'en plus.",
      "Ah, je vois. Et donc tu penses que... ?",
      "(Rire) Attends, attends, répète ça ?",
    ]);
  });

  it("should return fallback when AI returns empty string", async () => {
    mockGenerateScript.mockResolvedValueOnce("Opener").mockResolvedValueOnce("");

    const { generateScenarioScript } = await import("../generateScript");
    const result = await generateScenarioScript(defaultParams);

    expect(result.suggestedResponses).toEqual([
      "Hmm, intéressant... Dis-m'en plus.",
      "Ah, je vois. Et donc tu penses que... ?",
      "(Rire) Attends, attends, répète ça ?",
    ]);
  });

  it("should trim whitespace from each response line", async () => {
    mockGenerateScript
      .mockResolvedValueOnce("Opener")
      .mockResolvedValueOnce(
        ["  -  Réponse avec espaces  ", "  -  Réponse deuxième  ", "  -  Réponse troisième  "].join(
          "\n",
        ),
      );

    const { generateScenarioScript } = await import("../generateScript");
    const result = await generateScenarioScript(defaultParams);

    expect(result.suggestedResponses).toEqual([
      "Réponse avec espaces",
      "Réponse deuxième",
      "Réponse troisième",
    ]);
  });

  it("should handle mixed prefix formats in the same response", async () => {
    mockGenerateScript
      .mockResolvedValueOnce("Opener")
      .mockResolvedValueOnce("- Réponse dash\n* Réponse star\n1. Réponse num");

    const { generateScenarioScript } = await import("../generateScript");
    const result = await generateScenarioScript(defaultParams);

    expect(result.suggestedResponses).toEqual(["Réponse dash", "Réponse star", "Réponse num"]);
  });

  it("should preserve response content that looks like a list but isn't prefixed", async () => {
    mockGenerateScript
      .mockResolvedValueOnce("Opener")
      .mockResolvedValueOnce("- J'utilise - dans ma phrase\n- Une autre réponse\n- Et encore une");

    const { generateScenarioScript } = await import("../generateScript");
    const result = await generateScenarioScript(defaultParams);

    // First response: "- J'utilise - dans ma phrase"
    // After stripping leading "- " -> "J'utilise - dans ma phrase"
    expect(result.suggestedResponses).toHaveLength(3);
    expect(result.suggestedResponses[0]).toContain("J'utilise");
    expect(result.suggestedResponses[0]).toContain("dans ma phrase");
  });
});
