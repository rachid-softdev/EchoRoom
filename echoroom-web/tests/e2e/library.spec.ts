import { expect, test } from "@playwright/test";

test.describe("Library page", () => {
  test("should redirect to /login when unauthenticated", async ({ page }) => {
    await page.goto("/library");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  });

  test("route is handled (response < 400, not 404)", async ({ page }) => {
    const response = await page.request.get("/library");
    expect(response.status()).not.toBe(404);
    expect(response.status()).toBeLessThan(400);
  });

  test("should display the DashboardShell title 'Bibliothèque'", async ({ page }) => {
    await page.goto("/library");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/library");
    test.skip(redirected, "Authentication required to access library page");
    if (redirected) return;

    await expect(page.getByRole("heading", { name: "Bibliothèque" })).toBeVisible();
  });

  test("should display the subtitle text", async ({ page }) => {
    await page.goto("/library");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/library");
    test.skip(redirected, "Authentication required to access library page");
    if (redirected) return;

    await expect(page.getByText("Vos scénarios sauvegardés et vos créations")).toBeVisible();
  });

  test('should display "Nouveau" button with href="/create"', async ({ page }) => {
    await page.goto("/library");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/library");
    test.skip(redirected, "Authentication required to access library page");
    if (redirected) return;

    const nouveauLink = page.getByRole("link", { name: "Nouveau" });
    await expect(nouveauLink).toBeVisible();
    await expect(nouveauLink).toHaveAttribute("href", "/create");
  });

  test("should display the search input with correct placeholder", async ({ page }) => {
    await page.goto("/library");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/library");
    test.skip(redirected, "Authentication required to access library page");
    if (redirected) return;

    const searchInput = page.getByPlaceholder("Rechercher par titre, personnage ou créateur...");
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toBeEnabled();
  });

  test("should accept text in the search input", async ({ page }) => {
    await page.goto("/library");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/library");
    test.skip(redirected, "Authentication required to access library page");
    if (redirected) return;

    const searchInput = page.getByPlaceholder("Rechercher par titre, personnage ou créateur...");
    await searchInput.fill("test scénario");
    await expect(searchInput).toHaveValue("test scénario");
  });

  test("should display the clear search button when search has text", async ({ page }) => {
    await page.goto("/library");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/library");
    test.skip(redirected, "Authentication required to access library page");
    if (redirected) return;

    const searchInput = page.getByPlaceholder("Rechercher par titre, personnage ou créateur...");

    // Clear button should not exist initially
    await expect(page.getByRole("button", { name: "Effacer la recherche" })).not.toBeVisible();

    // Type text to make the clear button appear
    await searchInput.fill("test");
    await expect(page.getByRole("button", { name: "Effacer la recherche" })).toBeVisible();

    // Click clear button and verify search is cleared
    await page.getByRole("button", { name: "Effacer la recherche" }).click();
    await expect(searchInput).toHaveValue("");
  });
});
