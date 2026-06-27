import path from "node:path";
import { expect, test } from "@playwright/test";

const COMPONENT_PATH = path.resolve(__dirname, "../../src/components/social/ReportButton.tsx");

function readComponent(): string {
  return require("node:fs").readFileSync(COMPONENT_PATH, "utf-8");
}

test.describe("ReportButton component", () => {
  test("component is exported as a named export", () => {
    const source = readComponent();
    expect(source).toContain("export function ReportButton");
  });

  test("icon variant renders with variant ghost size icon", () => {
    const source = readComponent();
    expect(source).toContain('variant="ghost"');
    expect(source).toContain('size="icon"');
    expect(source).toContain('aria-label="Signaler"');
  });

  test("text variant renders with text Signaler and Flag icon", () => {
    const source = readComponent();
    expect(source).toContain("Signaler");
    expect(source).toMatch(/Flag/);
  });

  test("Flag icon is imported from lucide-react", () => {
    const source = readComponent();
    expect(source).toMatch(/import.*\bFlag\b.*from\s+["']lucide-react["']/);
  });

  test("dialog renders with title Signaler un contenu", () => {
    const source = readComponent();
    expect(source).toContain("<Dialog");
    expect(source).toContain("<DialogContent>");
    expect(source).toContain("<DialogHeader>");
    expect(source).toContain("Signaler un contenu");
  });

  test("textarea has placeholder about min 10 characters", () => {
    const source = readComponent();
    expect(source).toContain("minimum 10 caractères");
    expect(source).toMatch(/Textarea/);
  });

  test("character count helper text shows remaining characters", () => {
    const source = readComponent();
    expect(source).toContain("caractères minimum requis");
    expect(source).toContain("Signalement prêt à être envoyé");
  });

  test("submit button disabled when reason too short", () => {
    const source = readComponent();
    expect(source).toMatch(/disabled=\{reason\.trim\(\)\.length < MIN_REPORT_REASON_LENGTH/);
  });

  test("submit button variant is destructive", () => {
    const source = readComponent();
    expect(source).toContain('variant="destructive"');
  });

  test("cancel button closes dialog and resets reason", () => {
    const source = readComponent();
    expect(source).toContain("setOpen(false)");
    expect(source).toContain('setReason("")');
  });

  test("loading state shows Envoi... text", () => {
    const source = readComponent();
    expect(source).toContain("Envoi...");
    expect(source).toContain("isPending");
  });

  test("uses community.reportAbuse mutation", () => {
    const source = readComponent();
    expect(source).toMatch(/\.community\.reportAbuse\.useMutation/);
  });
});
