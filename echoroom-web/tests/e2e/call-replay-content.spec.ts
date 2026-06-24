import { test, expect } from "@playwright/test";

test.describe("Call replay page - additional scenarios", () => {
  test("should handle a route with a random UUID call ID (response under 400)", async ({ page }) => {
    // Use a properly formatted UUID that the middleware should handle gracefully
    const randomUuid = "550e8400-e29b-41d4-a716-446655440000";
    const response = await page.goto(`/call/${randomUuid}`);
    await page.waitForLoadState("networkidle");

    // The route should be handled by middleware (not a 404 or server crash)
    expect(response?.status()).toBeLessThan(400);

    // Unauthenticated users are redirected to the login page
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "Connexion" }),
    ).toBeVisible();
  });

  test("should display a page heading when navigating to a call replay route", async ({ page }) => {
    await page.goto("/call/another-test-call-id");
    await page.waitForLoadState("networkidle");

    // The route should be handled (not a 404 or 500)
    // For unauthenticated users, the middleware redirects to /login
    const currentUrl = page.url();

    // The final destination (login page after redirect) should have a heading
    const heading = page.getByRole("heading").first();
    await expect(heading).toBeVisible();
    await expect(heading).not.toBeEmpty();

    // Confirm we landed on a meaningful page (either login or the call replay)
    expect(currentUrl).not.toContain("404");
  });
});
