import { test, expect } from "@playwright/test";

test.describe("Profile page", () => {
  test("should redirect /profile/testuser to /login when unauthenticated", async ({ page }) => {
    await page.goto("/profile/testuser");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "Connexion" }),
    ).toBeVisible();
  });

  test("route /profile/testuser is handled (response < 400, not 404)", async ({ page }) => {
    const response = await page.request.get("/profile/testuser");
    expect(response.status()).not.toBe(404);
    expect(response.status()).toBeLessThan(400);

  });

  test("non-existent username returns not 404", async ({ page }) => {
    const response = await page.request.get("/profile/thisuserdoesnotexist99999");
    expect(response.status()).not.toBe(404);
  });

  test("profile page route pattern /profile/:username exists and is handled", async ({ page }) => {
    // The route pattern itself must not yield a framework-level 404
    const response = await page.request.get("/profile/someuser");
    const status = response.status();

    // The route is recognised by Next.js (not a framework 404)
    // If unauthenticated it redirects (status 302/307)
    // If the user doesn't exist the server calls notFound() (404)
    // Either way the route pattern itself is valid
    expect(status).not.toBe(404);
    expect(status).toBeLessThan(400);


  });
});
