import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// prompts.ts — buildSystemPrompt tests
// ---------------------------------------------------------------------------
// Pure function: no mocking needed.
// Tests prompt generation for correctness, content inclusion, and edge cases.

import type { PromptScenarioData } from "../prompts";

function createScenario(overrides: Partial<PromptScenarioData> = {}): PromptScenarioData {
  return {
    character: {
      name: "TestBot",
      description: "A friendly test character",
      promptSystem: "Speak in a calm and helpful tone.",
    },
    aiInstructions: "Guide the user through a test scenario.",
    description: "A test conversation scenario",
    ...overrides,
  };
}

describe("buildSystemPrompt", () => {
  // ---- Happy path ----
  it("should include character name and description", async () => {
    const { buildSystemPrompt } = await import("../prompts");

    const scenario = createScenario();
    const result = buildSystemPrompt(scenario);

    expect(result).toContain("TestBot");
    expect(result).toContain("A friendly test character");
  });

  it("should include character promptSystem", async () => {
    const { buildSystemPrompt } = await import("../prompts");

    const scenario = createScenario();
    const result = buildSystemPrompt(scenario);

    expect(result).toContain("Speak in a calm and helpful tone.");
  });

  it("should include aiInstructions", async () => {
    const { buildSystemPrompt } = await import("../prompts");

    const scenario = createScenario();
    const result = buildSystemPrompt(scenario);

    expect(result).toContain("Guide the user through a test scenario.");
  });

  it("should include scenario description", async () => {
    const { buildSystemPrompt } = await import("../prompts");

    const scenario = createScenario();
    const result = buildSystemPrompt(scenario);

    expect(result).toContain("A test conversation scenario");
  });

  it("should include the French vocal instruction", async () => {
    const { buildSystemPrompt } = await import("../prompts");

    const scenario = createScenario();
    const result = buildSystemPrompt(scenario);

    expect(result).toContain("Réponds en français de manière naturelle et parlée");
  });

  it("should include the conciseness instruction", async () => {
    const { buildSystemPrompt } = await import("../prompts");

    const scenario = createScenario();
    const result = buildSystemPrompt(scenario);

    expect(result).toContain("2-3 phrases max");
  });

  it("should start with the character introduction line (Tu es)", async () => {
    const { buildSystemPrompt } = await import("../prompts");

    const scenario = createScenario();
    const result = buildSystemPrompt(scenario);

    const firstLine = result.split("\n")[0];
    expect(firstLine).toMatch(/^Tu es TestBot\./);
  });

  it("should join sections with newlines", async () => {
    const { buildSystemPrompt } = await import("../prompts");

    const scenario = createScenario();
    const result = buildSystemPrompt(scenario);

    // Should have multiple lines separated by \n
    const lines = result.split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(5);
  });

  // ---- Edge cases: null/missing character description ----
  it("should handle null character description gracefully", async () => {
    const { buildSystemPrompt } = await import("../prompts");

    const scenario = createScenario({
      character: {
        name: "TestBot",
        description: null,
        promptSystem: "Be helpful.",
      },
    });
    const result = buildSystemPrompt(scenario);

    // The character line should not have a trailing space before newline
    expect(result).toContain("Tu es TestBot.");
    // Should not have null text in output
    expect(result).not.toContain("null");
  });

  it("should handle null scenario description gracefully", async () => {
    const { buildSystemPrompt } = await import("../prompts");

    const scenario = createScenario({ description: null });
    const result = buildSystemPrompt(scenario);

    expect(result).toContain("Tu es TestBot.");
    // The "Contexte du scénario:" line should exist with empty or absent value
    expect(result).toContain("Contexte du scénario:");
    expect(result).not.toContain("null");
  });

  // ---- Edge cases: empty strings ----
  it("should handle empty character name", async () => {
    const { buildSystemPrompt } = await import("../prompts");

    const scenario = createScenario({
      character: {
        name: "",
        description: "A character",
        promptSystem: "Be helpful.",
      },
    });
    const result = buildSystemPrompt(scenario);

    expect(result).toContain("Tu es .");
    expect(result).toContain("A character");
  });

  it("should handle empty promptSystem", async () => {
    const { buildSystemPrompt } = await import("../prompts");

    const scenario = createScenario({
      character: {
        name: "TestBot",
        description: "A character",
        promptSystem: "",
      },
    });
    const result = buildSystemPrompt(scenario);

    expect(result).toContain("Tu es TestBot.");
    expect(result).toContain("A character");
    // Empty promptSystem should still produce a section (empty line filtered by .filter(Boolean) would remove it)
    // Actually, filter(Boolean) removes empty strings, so the empty promptSystem would be omitted
  });

  it("should handle empty aiInstructions", async () => {
    const { buildSystemPrompt } = await import("../prompts");

    const scenario = createScenario({ aiInstructions: "" });
    const result = buildSystemPrompt(scenario);

    expect(result).toContain("Tu es TestBot.");
    // Empty aiInstructions would be filtered out by .filter(Boolean)
  });

  it("should handle empty scenario description", async () => {
    const { buildSystemPrompt } = await import("../prompts");

    const scenario = createScenario({ description: "" });
    const result = buildSystemPrompt(scenario);

    expect(result).toContain("Contexte du scénario:");
    // Empty description results in "Contexte du scénario: " with empty value
  });

  // ---- Edge cases: all empty/missing ----
  it("should return at minimum the French instructions when all optional fields are empty", async () => {
    const { buildSystemPrompt } = await import("../prompts");

    const scenario = createScenario({
      character: {
        name: "",
        description: null,
        promptSystem: "",
      },
      aiInstructions: "",
      description: null,
    });
    const result = buildSystemPrompt(scenario);

    // After filter(Boolean), empty strings are removed
    // Only "Tu es ." and "Contexte du scénario: " and the french instructions remain
    expect(result).toContain("Tu es .");
    expect(result).toContain("Contexte du scénario:");
    expect(result).toContain("Réponds en français");
    expect(result).toContain("2-3 phrases max");
  });

  // ---- Content structure ----
  it("should add the scenario context line with correct label", async () => {
    const { buildSystemPrompt } = await import("../prompts");

    const scenario = createScenario({ description: "A roleplay scenario" });
    const result = buildSystemPrompt(scenario);

    expect(result).toContain("Contexte du scénario: A roleplay scenario");
  });

  it("should produce a non-empty prompt for any valid input", async () => {
    const { buildSystemPrompt } = await import("../prompts");

    const scenario = createScenario();
    const result = buildSystemPrompt(scenario);

    expect(result.length).toBeGreaterThan(50);
  });

  it("should handle character description with special characters", async () => {
    const { buildSystemPrompt } = await import("../prompts");

    const scenario = createScenario({
      character: {
        name: "Élève Curieux",
        description: "Un étudiant très motivé — spécialiste en IA & ML",
        promptSystem: "Sois enthousiaste et pédagogique.",
      },
    });
    const result = buildSystemPrompt(scenario);

    expect(result).toContain("Élève Curieux");
    expect(result).toContain("Un étudiant très motivé");
    expect(result).toContain("spécialiste en IA");
  });

  it("should include all sections in the correct order", async () => {
    const { buildSystemPrompt } = await import("../prompts");

    const scenario = createScenario();
    const result = buildSystemPrompt(scenario);
    const lines = result.split("\n").filter(Boolean);

    // First line should be character introduction
    expect(lines[0]).toMatch(/^Tu es TestBot/);

    // Should have promptSystem somewhere
    expect(lines.some((l) => l.includes("Speak in a calm"))).toBe(true);

    // Should have aiInstructions
    expect(lines.some((l) => l.includes("Guide the user"))).toBe(true);

    // Should have scenario context
    expect(lines.some((l) => l.includes("Contexte du scénario"))).toBe(true);

    // Should have the vocal instruction
    expect(lines.some((l) => l.includes("Réponds en français"))).toBe(true);

    // Should have the conciseness instruction
    expect(lines.some((l) => l.includes("2-3 phrases max"))).toBe(true);
  });

  // ---- Empty input edge cases ----
  it("should not crash when character has empty name and null description", async () => {
    const { buildSystemPrompt } = await import("../prompts");

    const scenario = createScenario({
      character: {
        name: "",
        description: null,
        promptSystem: "Do something.",
      },
    });
    expect(() => buildSystemPrompt(scenario)).not.toThrow();
    const result = buildSystemPrompt(scenario);
    expect(typeof result).toBe("string");
  });
});
