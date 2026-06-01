import { test, expect } from "@playwright/test";

test.describe("Scenario detail page", () => {
  test("should show 404 not-found for a non-existent scenario ID", async ({ page }) => {
    await page.goto("/scenario/non-existent-id-00000", {
      // Bypass server-side redirect to ensure we see the 404 page
      waitUntil: "networkidle",
    });
    // Custom 404 page content
    await expect(page.getByText("404")).toBeVisible();
    await expect(page.getByText(/Oops/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Retour à l'accueil/ }),
    ).toBeVisible();
  });

  test("should show 404 for an empty scenario ID segment", async ({ page }) => {
    await page.goto("/scenario/", { waitUntil: "networkidle" });
    await expect(page.getByText("404")).toBeVisible();
  });

  test("should display the comments section heading when scenario loads", async ({ page }) => {
    // Navigate through explore to find an existing scenario
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    // Look for a scenario card link
    const scenarioLink = page.locator('a[href^="/scenario/"]').first();
    const linkExists = await scenarioLink.isVisible().catch(() => false);

    test.skip(!linkExists, "No scenarios available in the database to test detail page");
    if (!linkExists) return;

    // Navigate to the scenario detail page
    await scenarioLink.click();
    await page.waitForLoadState("networkidle");

    // Wait for the scenario content to load (skeleton to disappear)
    await expect(page.getByText("Commentaires")).toBeVisible();
  });

  test("should display the reaction bar when scenario loads", async ({ page }) => {
    // Navigate through explore to find an existing scenario
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    const scenarioLink = page.locator('a[href^="/scenario/"]').first();
    const linkExists = await scenarioLink.isVisible().catch(() => false);

    test.skip(!linkExists, "No scenarios available in the database to test detail page");
    if (!linkExists) return;

    await scenarioLink.click();
    await page.waitForLoadState("networkidle");

    // The reaction bar always renders — check for the "+" add reaction button
    await expect(
      page.getByRole("button", { name: "Ajouter une réaction" }),
    ).toBeVisible();
  });

  test("should display the scenario title when a valid scenario loads", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    const scenarioLink = page.locator('a[href^="/scenario/"]').first();
    const linkExists = await scenarioLink.isVisible().catch(() => false);

    test.skip(!linkExists, "No scenarios available in the database to test detail page");
    if (!linkExists) return;

    await scenarioLink.click();
    await page.waitForLoadState("networkidle");

    // Wait for scenario content to load by checking for stats or back link
    await expect(
      page.getByRole("link", { name: /Retour à la communauté/ }),
    ).toBeVisible();

    // The h1 title should be visible
    const title = page.locator("h1");
    await expect(title).toBeVisible();
    await expect(title).not.toBeEmpty();
  });

  test("should display the back navigation link on the scenario detail page", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    const scenarioLink = page.locator('a[href^="/scenario/"]').first();
    const linkExists = await scenarioLink.isVisible().catch(() => false);

    test.skip(!linkExists, "No scenarios available in the database to test detail page");
    if (!linkExists) return;

    await scenarioLink.click();
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("link", { name: /Retour à la communauté/ }),
    ).toBeVisible();
  });
});
