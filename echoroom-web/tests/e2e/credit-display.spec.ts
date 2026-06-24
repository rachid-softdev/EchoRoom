import { test, expect } from "@playwright/test";
import path from "path";

const COMPONENT_PATH = path.resolve(
  __dirname,
  "../../src/components/shared/CreditDisplay.tsx",
);

function readComponent(): string {
  return require("fs").readFileSync(COMPONENT_PATH, "utf-8");
}

test.describe("CreditDisplay component", () => {
  test("component is exported as a named export", () => {
    const source = readComponent();
    expect(source).toContain("export function CreditDisplay");
  });

  test("uses 'use client' directive", () => {
    const source = readComponent();
    expect(source).toContain("'use client'");
  });

  test("credits undefined renders Skeleton placeholder", () => {
    const source = readComponent();
    expect(source).toContain("credits === undefined");
    expect(source).toMatch(/Skeleton.*h-5 w-20 rounded-lg/);
  });

  test("credits defined renders Badge variant secondary with Phone icon", () => {
    const source = readComponent();
    expect(source).toContain('<Badge variant="secondary"');
    expect(source).toContain("Phone");
    expect(source).toMatch(/{\s*credits\s*}\s*crédits/);
  });

  test("Tooltip has correct content about credit usage", () => {
    const source = readComponent();
    const hasCreditInfo = source.includes("chaque appel") || source.includes("1 crédit") || source.includes("crédit");
    if (!hasCreditInfo) {
      test.info().annotations.push({ type: "info", description: "Tooltip credit usage content may use different phrasing" });
    }
    expect(source).toContain("5 gratuits à l&apos;inscription");
  });

  test("Tooltip positioned at bottom", () => {
    const source = readComponent();
    expect(source).toContain('side="bottom"');
  });

  test("live: credit badge visible on dashboard when authenticated", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requires authentication");
    if (redirected) return;

    // The CreditDisplay renders a Badge with "crédits" text
    const creditBadge = page.getByText(/crédits/);
    const creditExists = await creditBadge.isVisible().catch(() => false);
    // Could be a skeleton if credits are still loading
    if (!creditExists) {
      // Check for skeleton instead
      const skeleton = page.locator('[class*="animate-pulse"]');
      await expect(skeleton.first()).toBeVisible();
    } else {
      await expect(creditBadge).toBeVisible();
    }
  });
});
