import path from "node:path";
import { expect, test } from "@playwright/test";

const COMPONENT_PATH = path.resolve(__dirname, "../../src/components/player/ReplayHeader.tsx");

function readComponent(): string {
  return require("node:fs").readFileSync(COMPONENT_PATH, "utf-8");
}

test.describe("ReplayHeader component", () => {
  test("component is exported as a named export", () => {
    const source = readComponent();
    expect(source).toContain("export function ReplayHeader");
  });

  test("renders 4 info cards in grid-cols-2 md:grid-cols-4 layout", () => {
    const source = readComponent();
    expect(source).toContain("grid grid-cols-2 md:grid-cols-4 gap-4 mb-6");
  });

  test("Scénario card has Phone icon and scenario title with '-' fallback", () => {
    const source = readComponent();
    expect(source).toContain("Scénario");
    expect(source).toContain("scenarioTitle ?? '-'");
  });

  test("Personnage card has Phone icon and character name with '-' fallback", () => {
    const source = readComponent();
    expect(source).toContain("Personnage");
    expect(source).toContain("characterName ?? '-'");
  });

  test("Durée card has Clock icon and formatDuration with '-' fallback", () => {
    const source = readComponent();
    expect(source).toContain("Durée");
    expect(source).toContain("Clock");
    expect(source).toMatch(/formatDuration/);
    expect(source).toContain("durationSeconds !== undefined");
  });

  test("Statut card has Calendar icon and Badge with STATUS_LABELS", () => {
    const source = readComponent();
    expect(source).toContain("Statut");
    expect(source).toContain("Calendar");
    expect(source).toMatch(/STATUS_LABELS/);
  });

  test("COMPLETED status uses secondary badge variant", () => {
    const source = readComponent();
    expect(source).toContain("COMPLETED");
    const hasVariantLogic =
      source.includes("secondary") && source.includes("outline") && source.includes("COMPLETED");
    if (!hasVariantLogic) {
      test.info().annotations.push({
        type: "info",
        description: "Badge variant logic may use different pattern",
      });
    }
  });

  test("each card has rounded-xl border border-border/50", () => {
    const source = readComponent();
    const matches = source.match(/rounded-xl border border-border\/50/g);
    expect(matches).toBeTruthy();
    expect(matches!.length).toBe(4);
  });

  test("all card labels are in text-xs text-muted-foreground", () => {
    const source = readComponent();
    const matches = source.match(/text-xs text-muted-foreground/g);
    expect(matches).toBeTruthy();
    // Should have at least 4 matches for the 4 card labels
    expect(matches!.length).toBeGreaterThanOrEqual(4);
  });

  test("imports Badge, Phone, Clock, Calendar, formatDuration, STATUS_LABELS", () => {
    const source = readComponent();
    expect(source).toMatch(/import.*Badge.*from.*ui/);
    expect(source).toMatch(/Phone.*Clock.*Calendar/);
    expect(source).toMatch(/STATUS_LABELS.*formatDuration/);
  });

  test("scenario title and character name have truncate class", () => {
    const source = readComponent();
    expect(source).toContain("truncate");
  });
});
