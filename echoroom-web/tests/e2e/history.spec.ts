import { test, expect } from "@playwright/test";

test.describe("History page", () => {
  test("should redirect to /login when unauthenticated", async ({ page }) => {
    await page.goto("/history");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "Connexion" }),
    ).toBeVisible();
  });

  test("route is handled (response < 400, not 404)", async ({ page }) => {
    const response = await page.request.get("/history");
    expect(response.status()).not.toBe(404);
    expect(response.status()).toBeLessThan(400);
  });

  test("should display the DashboardShell title 'Historique des appels'", async ({ page }) => {
    await page.goto("/history");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/history");
    test.skip(redirected, "Authentication required to access history page");
    if (redirected) return;

    await expect(
      page.getByRole("heading", { name: "Historique des appels" }),
    ).toBeVisible();
  });

  test("should display the subtitle text", async ({ page }) => {
    await page.goto("/history");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/history");
    test.skip(redirected, "Authentication required to access history page");
    if (redirected) return;

    await expect(
      page.getByText("Consultez vos appels passés et réécoutez vos meilleurs moments"),
    ).toBeVisible();
  });

  test("should display the search input with correct placeholder", async ({ page }) => {
    await page.goto("/history");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/history");
    test.skip(redirected, "Authentication required to access history page");
    if (redirected) return;

    const searchInput = page.getByPlaceholder(
      "Rechercher par scénario, personnage ou statut...",
    );
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toBeEnabled();
  });

  test("should accept text in the search input", async ({ page }) => {
    await page.goto("/history");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/history");
    test.skip(redirected, "Authentication required to access history page");
    if (redirected) return;

    const searchInput = page.getByPlaceholder(
      "Rechercher par scénario, personnage ou statut...",
    );
    await searchInput.fill("test appel");
    await expect(searchInput).toHaveValue("test appel");
  });

  test("should display the clear search button when search has text", async ({ page }) => {
    await page.goto("/history");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/history");
    test.skip(redirected, "Authentication required to access history page");
    if (redirected) return;

    const searchInput = page.getByPlaceholder(
      "Rechercher par scénario, personnage ou statut...",
    );

    // Clear button should not exist initially
    await expect(
      page.getByRole("button", { name: "Effacer la recherche" }),
    ).not.toBeVisible();

    // Type text to make the clear button appear
    await searchInput.fill("test");
    await expect(
      page.getByRole("button", { name: "Effacer la recherche" }),
    ).toBeVisible();

    // Click clear button and verify search is cleared
    await page.getByRole("button", { name: "Effacer la recherche" }).click();
    await expect(searchInput).toHaveValue("");
  });
});
