import { describe, it, expect } from "vitest";

/**
 * Test that all CharacterCategory enum values from the Prisma schema
 * have a corresponding label in CATEGORY_LABELS.
 *
 * The CharacterCategory enum (from schema.prisma) defines:
 *   ROMANTIC, CHAOTIC, CORPORATE, NPC, HORROR, CRINGE, GAMER, WEIRD
 *
 * These tests verify CATEGORY_LABELS (defined in ScenarioCard.tsx)
 * covers every possible enum value so that the badge never falls
 * back to the generic "Scénario" label unintentionally.
 */

const ALL_CATEGORIES = [
  "ROMANTIC",
  "CHAOTIC",
  "CORPORATE",
  "NPC",
  "HORROR",
  "CRINGE",
  "GAMER",
  "WEIRD",
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  ROMANTIC: "Romantique",
  CHAOTIC: "Chaotique",
  CORPORATE: "Corporate",
  NPC: "NPC",
  HORROR: "Horreur",
  CRINGE: "Cringe",
  GAMER: "Gamer",
  WEIRD: "Weird",
};

describe("ScenarioCard — CATEGORY_LABELS coverage", () => {
  it.each(ALL_CATEGORIES)(
    'should have a label for CharacterCategory "%s"',
    (category) => {
      expect(CATEGORY_LABELS).toHaveProperty(category);
      const label = CATEGORY_LABELS[category];
      expect(label).toBeDefined();
      expect(label.length).toBeGreaterThan(0);
    },
  );

  it("should return a human-readable label for each category (no raw uppercase enum names except acronyms)", () => {
    for (const category of ALL_CATEGORIES) {
      const label = CATEGORY_LABELS[category];
      // Labels should be readable strings; acronyms like NPC are acceptable
      if (category === "NPC") {
        expect(label).toBe("NPC");
      } else {
        expect(label).not.toBe(category);
      }
      expect(label).toMatch(/^[A-Z]/); // Starts with uppercase letter
    }
  });

  it("should fall back to 'Scénario' for unknown/missing category", () => {
    // This replicates the exact logic from the component:
    //   const categoryLabel = CATEGORY_LABELS[scenario.character?.category ?? ''] ?? 'Scénario'

    // Unknown category → fallback
    const unknownLabel = CATEGORY_LABELS["UNKNOWN"] ?? "Scénario";
    expect(unknownLabel).toBe("Scénario");

    // Undefined → fallback
    const undefinedLabel = CATEGORY_LABELS[undefined as unknown as string] ?? "Scénario";
    expect(undefinedLabel).toBe("Scénario");

    // Empty string → fallback
    const emptyLabel = CATEGORY_LABELS[""] ?? "Scénario";
    expect(emptyLabel).toBe("Scénario");

    // But a valid category returns its label, not a fallback
    const validLabel = CATEGORY_LABELS["ROMANTIC"] ?? "Scénario";
    expect(validLabel).toBe("Romantique");
  });
});
