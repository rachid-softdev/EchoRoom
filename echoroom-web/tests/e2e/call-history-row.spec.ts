import path from "node:path";
import { expect, test } from "@playwright/test";

const COMPONENT_PATH = path.resolve(__dirname, "../../src/components/shared/CallHistoryRow.tsx");

function readComponent(): string {
  return require("node:fs").readFileSync(COMPONENT_PATH, "utf-8");
}

test.describe("CallHistoryRow component", () => {
  test("component is exported as a named export", () => {
    const source = readComponent();
    expect(source).toContain("export function CallHistoryRow");
  });

  test("renders Phone icon in rounded-full bg-primary/10 container", () => {
    const source = readComponent();
    expect(source).toContain("rounded-full bg-primary/10");
    expect(source).toMatch(/Phone.*w-5 h-5 text-primary/);
  });

  test("scenario title shown as truncate with fallback 'Appel'", () => {
    const source = readComponent();
    expect(source).toContain("font-medium text-sm truncate");
    expect(source).toMatch(/call\.scenario\?\.title.*'Appel'/);
  });

  test("status badge uses STATUS_VARIANTS and STATUS_LABELS", () => {
    const source = readComponent();
    expect(source).toMatch(/STATUS_VARIANTS\[call\.status\]/);
    expect(source).toMatch(/STATUS_LABELS\[call\.status\]/);
  });

  test("date rendered via formatDate", () => {
    const source = readComponent();
    expect(source).toMatch(/formatDate\(call\.createdAt\)/);
  });

  test("duration rendered via formatDuration", () => {
    const source = readComponent();
    expect(source).toMatch(/formatDuration\(call\.durationSeconds\)/);
  });

  test("Replay button with Play icon shown only when COMPLETED", () => {
    const source = readComponent();
    expect(source).toContain("COMPLETED");
    expect(source).toContain("Replay");
    expect(source).toMatch(/Play.*w-4 h-4/);
  });

  test("Replay button links to /call/{id}", () => {
    const source = readComponent();
    expect(source).toMatch(/Link.*href=.*\/call\/.*call\.id/);
  });

  test("has hover:border-border transition", () => {
    const source = readComponent();
    expect(source).toContain("hover:border-border transition-colors");
  });

  test("imports Badge and Button from ui", () => {
    const source = readComponent();
    expect(source).toMatch(/import.*Badge.*from.*ui/);
    expect(source).toMatch(/import.*Button.*from.*ui/);
  });

  test("imports Phone and Play from lucide-react", () => {
    const source = readComponent();
    expect(source).toMatch(/import.*\{.*Phone.*Play.*\}.*from.*lucide-react/);
  });
});
