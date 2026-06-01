import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("should display the main navigation bar on the home page", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav").first();
    await expect(nav).toBeVisible();
  });

  test("should show Connexion button for unauthenticated users", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Connexion" }),
    ).toBeVisible();
  });

  test("should show S'inscrire button for unauthenticated users", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: /S'inscrire/ }),
    ).toBeVisible();
  });

  test("should navigate to /explore when clicking Explorer link", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Explorer" }).first().click();
    await expect(page).toHaveURL("/explore");
    await expect(
      page.getByRole("heading", { name: /Explorer les scénarios/ }),
    ).toBeVisible();
  });

  test("should navigate to /pricing when clicking Tarifs link", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Tarifs" }).first().click();
    await expect(page).toHaveURL("/pricing");
  });

  test("should navigate to /login when clicking Connexion", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Connexion" }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "Connexion" }),
    ).toBeVisible();
  });

  test("should navigate to /register when clicking S'inscrire", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /S'inscrire/ }).click();
    await expect(page).toHaveURL(/\/register/);
  });

  test("should navigate back to home page when clicking EchoRoom branding", async ({ page }) => {
    // Go to explore page first
    await page.goto("/explore");
    // Click the "Accueil" back link
    await page.getByRole("link", { name: /Accueil/ }).click();
    await expect(page).toHaveURL("/");
  });

  test("should show mobile navigation menu on small viewport", async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    // The mobile menu button should be visible (hamburger menu)
    const menuButton = page.getByRole("button", { name: "Menu" });
    await expect(menuButton).toBeVisible();

    // Click to open the mobile menu
    await menuButton.click();

    // Mobile menu links should now be visible
    await expect(
      page.getByRole("link", { name: "Explorer" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Tarifs" }),
    ).toBeVisible();
  });

  test("should navigate from mobile menu to explore page", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    // Open mobile menu
    await page.getByRole("button", { name: "Menu" }).click();

    // Click Explorer in mobile menu
    await page.getByRole("link", { name: "Explorer" }).click();
    await expect(page).toHaveURL("/explore");
  });
});
