import { expect, test } from "@playwright/test";

test.describe("Admin route protection", () => {
  test("should redirect /admin to /login when unauthenticated", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  });

  test("should redirect /admin/users to /login when unauthenticated", async ({ page }) => {
    await page.goto("/admin/users");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  });

  test("should redirect /admin/analytics to /login when unauthenticated", async ({ page }) => {
    await page.goto("/admin/analytics");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  });

  test("should redirect /admin/moderation to /login when unauthenticated", async ({ page }) => {
    await page.goto("/admin/moderation");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  });
});
