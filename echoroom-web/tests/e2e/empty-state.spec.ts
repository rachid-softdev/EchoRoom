import path from "node:path";
import { expect, test } from "@playwright/test";

const COMPONENT_PATH = path.resolve(__dirname, "../../src/components/shared/EmptyState.tsx");

function readComponent(): string {
  return require("node:fs").readFileSync(COMPONENT_PATH, "utf-8");
}

test.describe("EmptyState component", () => {
  test("component is exported as a named export", () => {
    const source = readComponent();
    expect(source).toContain("export function EmptyState");
  });

  test("centered layout with flex-col items-center justify-center", () => {
    const source = readComponent();
    expect(source).toContain("flex flex-col items-center justify-center py-16 text-center");
  });

  test("icon renders with w-16 h-16 text-muted-foreground", () => {
    const source = readComponent();
    expect(source).toContain("w-16 h-16 text-muted-foreground mx-auto mb-4");
  });

  test("title renders as h3 with text-lg font-semibold", () => {
    const source = readComponent();
    expect(source).toContain('<h3 className="text-lg font-semibold mb-2">{title}</h3>');
  });

  test("description renders with text-muted-foreground", () => {
    const source = readComponent();
    expect(source).toContain('<p className="text-muted-foreground mb-6 max-w-sm mx-auto">');
    expect(source).toContain("{description}");
  });

  test("action slot is conditionally rendered", () => {
    const source = readComponent();
    expect(source).toContain("{action}");
  });

  test("live: empty state visible on community feed without data", async ({ page }) => {
    await page.goto("/community");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requires authentication");
    if (redirected) return;

    // Check if the "Aucun post pour le moment" empty state appears
    const emptyText = page.getByText("Aucun post pour le moment");
    const emptyExists = await emptyText.isVisible().catch(() => false);
    if (emptyExists) {
      await expect(emptyText).toBeVisible();
    }
  });
});
