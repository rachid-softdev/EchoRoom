import { test, expect } from "@playwright/test";

test.describe("Dashboard pages", () => {
  test("should have a dashboard route that redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // The dashboard is protected — verify redirect to login
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "Connexion" }),
    ).toBeVisible();
  });

  test("should have a create route with correct page structure", async ({ page }) => {
    await page.goto("/create");
    await page.waitForLoadState("networkidle");

    // The create page is protected — verify redirect to login
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "Connexion" }),
    ).toBeVisible();
  });

  test("should have a library route with correct page structure", async ({ page }) => {
    await page.goto("/library");
    await page.waitForLoadState("networkidle");

    // The library page is protected — verify redirect to login
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "Connexion" }),
    ).toBeVisible();
  });

  test("should have a settings route that redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // The settings page is protected — verify redirect to login
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "Connexion" }),
    ).toBeVisible();
  });

  test("should have a billing route that redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/billing");
    await page.waitForLoadState("networkidle");

    // The billing page is protected — verify redirect to login
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "Connexion" }),
    ).toBeVisible();
  });
});
