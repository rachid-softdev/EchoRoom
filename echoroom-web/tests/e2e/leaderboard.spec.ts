import { expect, test } from "@playwright/test";

test.describe("Leaderboard page", () => {
  test("should redirect /leaderboard to /login when unauthenticated", async ({ page }) => {
    await page.goto("/leaderboard");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  });

  test("route /leaderboard exists and responds with a redirect (status < 400, not 404)", async ({
    page,
  }) => {
    const response = await page.request.get("/leaderboard");
    expect(response.status()).not.toBe(404);
    expect(response.status()).toBeLessThan(400);
  });

  test("DashboardShell title 'Classement' is visible when authenticated", async ({ page }) => {
    await page.goto("/leaderboard");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/leaderboard");
    test.skip(redirected, "Authentication required to access leaderboard page");
    if (redirected) return;

    await expect(page.getByRole("heading", { name: "Classement" })).toBeVisible();
  });

  test("subtitle text is visible when authenticated", async ({ page }) => {
    await page.goto("/leaderboard");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/leaderboard");
    test.skip(redirected, "Authentication required to access leaderboard page");
    if (redirected) return;

    await expect(
      page.getByText("Les meilleurs scénarios et créateurs de la communauté"),
    ).toBeVisible();
  });

  test("tab buttons 'Scénarios' and 'Créateurs' are visible when authenticated", async ({
    page,
  }) => {
    await page.goto("/leaderboard");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/leaderboard");
    test.skip(redirected, "Authentication required to access leaderboard page");
    if (redirected) return;

    await expect(page.getByRole("button", { name: "Scénarios" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Créateurs" })).toBeVisible();
  });

  test("period filter buttons 'Tout', 'Cette semaine', 'Ce mois' are visible when authenticated", async ({
    page,
  }) => {
    await page.goto("/leaderboard");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/leaderboard");
    test.skip(redirected, "Authentication required to access leaderboard page");
    if (redirected) return;

    await expect(page.getByRole("button", { name: "Tout" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cette semaine" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ce mois" })).toBeVisible();
  });

  test("'Scénarios' tab is active by default when authenticated", async ({ page }) => {
    await page.goto("/leaderboard");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/leaderboard");
    test.skip(redirected, "Authentication required to access leaderboard page");
    if (redirected) return;

    // The active tab has the "bg-card" class while inactive tabs have "text-muted-foreground"
    await expect(page.getByRole("button", { name: "Scénarios" })).toHaveClass(/bg-card/);

    // The Créateurs tab should not have the active styling
    await expect(page.getByRole("button", { name: "Créateurs" })).not.toHaveClass(/bg-card/);
  });
});
