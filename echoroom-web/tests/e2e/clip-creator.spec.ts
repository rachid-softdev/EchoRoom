import path from "node:path";
import { expect, test } from "@playwright/test";

const COMPONENT_PATH = path.resolve(__dirname, "../../src/components/social/ClipCreator.tsx");

function readComponent(): string {
  return require("node:fs").readFileSync(COMPONENT_PATH, "utf-8");
}

test.describe("ClipCreator component", () => {
  test("component is exported as a named export", () => {
    const source = readComponent();
    expect(source).toContain("export function ClipCreator");
  });

  test("renders title with Scissors icon and Créer un clip text", () => {
    const source = readComponent();
    expect(source).toMatch(/Scissors/);
    expect(source).toContain("Créer un clip");
  });

  test("has clip-title input with placeholder Clip and maxLength=100", () => {
    const source = readComponent();
    expect(source).toContain('id="clip-title"');
    expect(source).toContain('placeholder="Clip"');
    expect(source).toContain("maxLength={100}");
  });

  test("has clip-start input with type number min=0 max=durationSeconds", () => {
    const source = readComponent();
    expect(source).toContain('id="clip-start"');
    expect(source).toContain('type="number"');
    expect(source).toContain("min={0}");
    expect(source).toContain("max={durationSeconds}");
    expect(source).toContain("step={1}");
  });

  test("has clip-end input with type number min=0 max=durationSeconds", () => {
    const source = readComponent();
    expect(source).toContain('id="clip-end"');
    expect(source).toContain('type="number"');
    expect(source).toContain("min={0}");
    expect(source).toContain("max={durationSeconds}");
    expect(source).toContain("step={1}");
  });

  test("isValid requires start >= 0, end > start, end <= durationSeconds", () => {
    const source = readComponent();
    expect(source).toContain("startTime >= 0");
    expect(source).toContain("endTime > startTime");
    expect(source).toContain("endTime <= durationSeconds");
  });

  test("submit button Créer le clip disabled when !isValid or isPending", () => {
    const source = readComponent();
    expect(source).toContain("disabled={!isValid || createMutation.isPending}");
    expect(source).toContain("Créer le clip");
  });

  test("startTime uses Math.max(0, ...) for clamping", () => {
    const source = readComponent();
    expect(source).toContain("Math.max(0, Math.round(Number(e.target.value)))");
  });

  test("endTime uses Math.min(durationSeconds, Math.max(0, ...)) for clamping", () => {
    const source = readComponent();
    expect(source).toContain(
      "Math.min(durationSeconds, Math.max(0, Math.round(Number(e.target.value))))",
    );
  });

  test("error message shown when invalid and fields have values", () => {
    const source = readComponent();
    expect(source).toContain("La fin doit être après le début");
    expect(source).toMatch(/!isValid.*startTime > 0.*endTime > 0/);
  });

  test("loading state shows Création...", () => {
    const source = readComponent();
    expect(source).toContain("Création...");
  });

  test("uses social.createClip mutation", () => {
    const source = readComponent();
    expect(source).toMatch(/\.social\.createClip\.useMutation/);
  });

  test("success resets form fields", () => {
    const source = readComponent();
    expect(source).toContain('setTitle("")');
    expect(source).toContain("setStartTime(0)");
    expect(source).toContain("setEndTime(durationSeconds)");
  });
});
