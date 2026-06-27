import { expect, test } from "@playwright/test";

test.describe("Community page", () => {
  test("should redirect /community to /login when unauthenticated", async ({ page }) => {
    await page.goto("/community");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  });

  test("route /community exists and responds with a redirect (status < 400, not 404)", async ({
    page,
  }) => {
    const response = await page.request.get("/community");
    expect(response.status()).not.toBe(404);
    expect(response.status()).toBeLessThan(400);
  });

  test("DashboardShell title 'Communauté' is visible when authenticated", async ({ page }) => {
    await page.goto("/community");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/community");
    test.skip(redirected, "Authentication required to access community page");
    if (redirected) return;

    await expect(page.getByRole("heading", { name: "Communauté" })).toBeVisible();
  });

  test("subtitle text is visible when authenticated", async ({ page }) => {
    await page.goto("/community");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/community");
    test.skip(redirected, "Authentication required to access community page");
    if (redirected) return;

    await expect(page.getByText("Les meilleurs moments partagés par la communauté")).toBeVisible();
  });

  test("feed data loads and displays either posts or the empty state", async ({ page }) => {
    await page.goto("/community");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/community");
    test.skip(redirected, "Authentication required to access community page");
    if (redirected) return;

    // Wait for data to finish loading
    await page.waitForLoadState("networkidle");

    // After loading, either scenario cards exist or empty state is shown
    const scenarioLink = page.locator('a[href^="/scenario/"]').first();
    const emptyState = page.getByText("Aucun post pour le moment").first();

    const hasScenarioCards = await scenarioLink.isVisible().catch(() => false);
    const hasEmptyState = await emptyState.isVisible().catch(() => false);

    if (hasScenarioCards) {
      await expect(scenarioLink).toBeVisible();
    } else if (hasEmptyState) {
      await expect(emptyState).toBeVisible();
    }
    // If neither is found (still loading or error), fail with a helpful message
    if (!hasScenarioCards && !hasEmptyState) {
      await expect(page.getByText("Aucun post pour le moment")).toBeVisible({ timeout: 10000 });
    }
  });

  test("comment input placeholder 'Ajouter un commentaire...' is visible when data loaded", async ({
    page,
  }) => {
    await page.goto("/community");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/community");
    test.skip(redirected, "Authentication required to access community page");
    if (redirected) return;

    // Wait for data to finish loading
    await page.waitForLoadState("networkidle");

    // Check if scenarios are displayed — comment input only renders with data
    const scenarioLink = page.locator('a[href^="/scenario/"]').first();
    const hasScenarioCards = await scenarioLink.isVisible().catch(() => false);
    test.skip(!hasScenarioCards, "No posts to display comment input");

    await expect(page.getByPlaceholder("Ajouter un commentaire...")).toBeVisible();
  });

  test("comment send button is visible when data loaded", async ({ page }) => {
    await page.goto("/community");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/community");
    test.skip(redirected, "Authentication required to access community page");
    if (redirected) return;

    // Wait for data to finish loading
    await page.waitForLoadState("networkidle");

    // Check if scenarios are displayed — send button only renders with data
    const scenarioLink = page.locator('a[href^="/scenario/"]').first();
    const hasScenarioCards = await scenarioLink.isVisible().catch(() => false);
    test.skip(!hasScenarioCards, "No posts to display comment send button");

    // The send button is a sibling of the comment input inside the same parent div
    const sendButton = page
      .getByPlaceholder("Ajouter un commentaire...")
      .locator("xpath=../button");
    await expect(sendButton.first()).toBeVisible();
  });
});
