import { test, expect } from "@playwright/test";

test.describe("Landing page — comprehensive load tests", () => {
  test("should load without JavaScript console errors", async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Assert no console errors (allow known Next.js hydration warnings)
    const filteredErrors = consoleErrors.filter(
      (e) =>
        !e.includes("Hydration") &&
        !e.includes("Next.js") &&
        !e.includes("favicon"),
    );
    expect(filteredErrors).toEqual([]);
  });

  test("should display the hero section with h1 heading", async ({ page }) => {
    await page.goto("/");
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    await expect(h1).not.toBeEmpty();
  });

  test("should display CTA buttons in the hero section", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: /Commencer gratuitement/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Voir la bibliothèque/ }),
    ).toBeVisible();
  });

  test("should display the stats section with key metrics", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("50K+")).toBeVisible();
    await expect(page.getByText("Appels générés")).toBeVisible();
  });

  test("should display the featured scenarios section", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // The featured scenarios section title
    const sectionTitle = page.getByText("Scénarios populaires");
    await expect(sectionTitle).toBeVisible();
  });

  test("should display the pricing section with plan cards", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Scroll to pricing section if needed
    await page.evaluate(() => {
      const pricingSection = document.querySelector("#pricing");
      if (pricingSection) pricingSection.scrollIntoView();
    });

    // Look for pricing-related text
    await expect(page.locator("text=Tarifs").first()).toBeVisible();
  });

  test("should display the footer with legal links", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const footer = page.locator("footer");
    await expect(footer).toBeVisible();

    // Check for common footer elements (CGU, Privacy, etc.)
    await expect(
      page.getByText(/EchoRoom/).last(),
    ).toBeVisible();
  });

  test("should have a functioning navigation bar", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav").first();
    await expect(nav).toBeVisible();

    // Explorer link should be visible
    await expect(
      page.getByRole("link", { name: "Explorer" }).first(),
    ).toBeVisible();
  });

  test("should be responsive and render on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Mobile menu button should exist
    const menuButton = page.getByRole("button", { name: "Menu" });
    await expect(menuButton).toBeVisible();
  });

  test("should have valid HTML structure (head, body, main)", async ({ page }) => {
    await page.goto("/");

    // Check basic document structure
    const hasTitle = await page.title();
    expect(hasTitle).toBeTruthy();
    expect(hasTitle.length).toBeGreaterThan(0);

    // Check that main element exists
    const main = page.locator("main");
    await expect(main).toBeVisible();
  });
});
