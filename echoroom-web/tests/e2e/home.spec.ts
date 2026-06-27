import { expect, test } from "@playwright/test";

test.describe("Home page", () => {
  test("should load the home page successfully", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/EchoRoom AI/);
    await expect(page.locator("nav")).toBeVisible();
  });

  test("should display the navigation bar with branding", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav").first();
    await expect(nav).toBeVisible();
    await expect(nav.getByText("EchoRoom")).toBeVisible();
  });

  test("should navigate to explore page via the Explorer link", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Explorer" }).first().click();
    await expect(page).toHaveURL(/\/explore/);
    await expect(page.getByRole("heading", { name: /Explorer les scénarios/ })).toBeVisible();
  });

  test("should display the hero section", async ({ page }) => {
    await page.goto("/");
    const hero = page.locator("section").first();
    await expect(hero).toBeVisible();
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByText(/appels IA/)).toBeVisible();
  });

  test("should display the stats section on the home page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("50K+")).toBeVisible();
    await expect(page.getByText("Appels générés")).toBeVisible();
  });

  test("should display CTA buttons in the hero section", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Commencer gratuitement/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Voir la bibliothèque/ })).toBeVisible();
  });
});
