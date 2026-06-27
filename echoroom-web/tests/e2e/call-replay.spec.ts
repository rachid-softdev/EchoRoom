import { expect, test } from "@playwright/test";

test.describe("Call replay page", () => {
  test("should redirect to /login when unauthenticated accessing /call/:id", async ({ page }) => {
    await page.goto("/call/some-call-id");
    await page.waitForLoadState("networkidle");

    // The call replay page is protected by middleware
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  });

  test("should redirect to /login when unauthenticated accessing /call/non-existent-id", async ({
    page,
  }) => {
    await page.goto("/call/non-existent-id-00000");
    await page.waitForLoadState("networkidle");

    // Protected route — redirects to login
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  });

  test("should redirect to /login when accessing /call/ with empty id", async ({ page }) => {
    await page.goto("/call/");
    await page.waitForLoadState("networkidle");

    // Protected route — redirects to login
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  });

  test("should have a valid call replay page route structure", async ({ page }) => {
    // Verify the route exists by checking that it's handled (redirect to login)
    const response = await page.goto("/call/test-call-id");
    await page.waitForLoadState("networkidle");

    // The route should be handled (not 404) — it redirects to login
    expect(response?.status()).toBeLessThan(400);

    // Confirm redirect to login page
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  });
});
