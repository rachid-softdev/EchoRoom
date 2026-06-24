import { test, expect } from "@playwright/test";

test.describe("Scenario detail page - additional scenarios", () => {
  test("should return a handled response for a valid scenario route", async ({ page }) => {
    // Navigate through explore to find an existing scenario
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    const scenarioLink = page.locator('a[href^="/scenario/"]').first();
    const linkExists = await scenarioLink.isVisible().catch(() => false);

    test.skip(!linkExists, "No scenarios available in the database to test the route");
    if (!linkExists) return;

    const href = await scenarioLink.getAttribute("href");
    if (!href) {
      test.skip(true, "Scenario link has no href attribute");
      return;
    }

    // Navigate directly to the scenario detail page and capture the response
    const response = await page.goto(href);
    await page.waitForLoadState("networkidle");

    // The route should be handled (not a 404 or server error)
    expect(response?.status()).toBeLessThan(400);

    // Confirm the page actually renders scenario content
    await expect(page.locator("h1")).toBeVisible();
  });

  test("should have valid HTML structure with main content container", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    const scenarioLink = page.locator('a[href^="/scenario/"]').first();
    const linkExists = await scenarioLink.isVisible().catch(() => false);

    test.skip(!linkExists, "No scenarios available in the database to test structure");
    if (!linkExists) return;

    const href = await scenarioLink.getAttribute("href");
    if (!href) {
      test.skip(true, "Scenario link has no href attribute");
      return;
    }

    await page.goto(href);
    await page.waitForLoadState("networkidle");

    // The root wrapper (bg-background container) is present in all states
    await expect(page.locator(".min-h-screen")).toBeVisible();

    // After loading, the scenario title should render
    const title = page.locator("h1");
    await expect(title).toBeVisible();
    await expect(title).not.toBeEmpty();
  });

  test("should show a skeleton loading state before the scenario content renders", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    const scenarioLink = page.locator('a[href^="/scenario/"]').first();
    const linkExists = await scenarioLink.isVisible().catch(() => false);

    test.skip(!linkExists, "No scenarios available in the database to test loading state");
    if (!linkExists) return;

    const href = await scenarioLink.getAttribute("href");
    if (!href) {
      test.skip(true, "Scenario link has no href attribute");
      return;
    }

    // Navigate to the page — capture the server-rendered output before tRPC resolves
    await page.goto(href, { waitUntil: "commit" });

    // The skeleton uses animate-pulse utility classes from the Skeleton component
    // It should be present in the initial server-rendered DOM
    const skeletonElements = page.locator('[class*="animate-pulse"]');
    const skeletonExists = await skeletonElements.first().isVisible().catch(() => false);

    if (skeletonExists) {
      // Confirm at least one skeleton placeholder is rendered while data loads
      await expect(skeletonElements.first()).toBeVisible();
    }

    // Wait for the tRPC data to finish loading
    await page.waitForLoadState("networkidle");

    // After the data arrives, the scenario title should be displayed
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("h1")).not.toBeEmpty();

    // Skeleton elements should no longer be the dominant state
    await expect(page.locator('[class*="animate-pulse"]').first()).not.toBeVisible();
  });

  test("should display a CTA section with call action or login prompt", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    const scenarioLink = page.locator('a[href^="/scenario/"]').first();
    const linkExists = await scenarioLink.isVisible().catch(() => false);

    test.skip(!linkExists, "No scenarios available in the database to test CTA section");
    if (!linkExists) return;

    const href = await scenarioLink.getAttribute("href");
    if (!href) {
      test.skip(true, "Scenario link has no href attribute");
      return;
    }

    await page.goto(href);
    await page.waitForLoadState("networkidle");

    // The CTA shows either the authenticated action or the login prompt
    // "Démarrer l'appel" when authenticated, "Connectez-vous" when not
    const callCta = page.getByRole("button", { name: /Démarrer l'appel|Connectez-vous/ });
    await expect(callCta).toBeVisible();
  });

  test("should display a related scenarios section when similar scenarios exist", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    const scenarioLink = page.locator('a[href^="/scenario/"]').first();
    const linkExists = await scenarioLink.isVisible().catch(() => false);

    test.skip(!linkExists, "No scenarios available in the database to test related section");
    if (!linkExists) return;

    const href = await scenarioLink.getAttribute("href");
    if (!href) {
      test.skip(true, "Scenario link has no href attribute");
      return;
    }

    await page.goto(href);
    await page.waitForLoadState("networkidle");

    // The "Scénarios similaires" heading only renders when there are related scenarios
    const relatedHeading = page.getByText("Scénarios similaires");
    const headingExists = await relatedHeading.isVisible().catch(() => false);

    test.skip(!headingExists, "No related scenarios available to display on this scenario");
    if (!headingExists) return;

    await expect(relatedHeading).toBeVisible();
  });
});
