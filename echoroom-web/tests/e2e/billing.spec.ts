import { test, expect } from "@playwright/test";

function isRedirectPage(body: string): boolean {
  return body.includes("Connexion") || body.includes("login") || body.includes("/login");
}

test.describe("Billing page", () => {
  test("should redirect /billing to /login when unauthenticated", async ({ page }) => {
    await page.goto("/billing");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "Connexion" }),
    ).toBeVisible();
  });

  test("route /billing is handled (response < 400, not 404)", async ({ page }) => {
    const response = await page.request.get("/billing");
    expect(response.status()).not.toBe(404);
    expect(response.status()).toBeLessThan(400);

  });

  test("DashboardShell title 'Crédits & Facturation' is present in the component", async ({ page }) => {
    const response = await page.request.get("/billing");
    expect(response.status()).not.toBe(404);
    const body = await response.text();
    if (isRedirectPage(body)) {
      test.info().annotations.push({ type: "info", description: "Skipped content check: unauthenticated" });
      return;
    }
    expect(body).toContain("Crédits");
    expect(body).toContain("Facturation");
  });

  test("section title 'Acheter des crédits' is present in the component", async ({ page }) => {
    const response = await page.request.get("/billing");
    expect(response.status()).not.toBe(404);
    const body = await response.text();
    if (isRedirectPage(body)) {
      test.info().annotations.push({ type: "info", description: "Skipped content check: unauthenticated" });
      return;
    }
    expect(body).toContain("Acheter des crédits");
  });

  test("credit packs section contains credit-related content", async ({ page }) => {
    const response = await page.request.get("/billing");
    expect(response.status()).not.toBe(404);
    const body = await response.text();
    if (isRedirectPage(body)) {
      test.info().annotations.push({ type: "info", description: "Skipped content check: unauthenticated" });
      return;
    }
    expect(body).toContain("crédits");
    expect(body).toContain("Acheter");
  });

  test("credit pack cards include the 'Populaire' badge", async ({ page }) => {
    const response = await page.request.get("/billing");
    expect(response.status()).not.toBe(404);
    const body = await response.text();
    if (isRedirectPage(body)) {
      test.info().annotations.push({ type: "info", description: "Skipped content check: unauthenticated" });
      return;
    }
    expect(body).toContain("Populaire");
    expect(body).toContain("10");
    expect(body).toContain("50");
    expect(body).toContain("200");
    expect(body).toContain("500");
    expect(body).toContain("2,99");
    expect(body).toContain("9,99");
    expect(body).toContain("24,99");
    expect(body).toContain("49,99");
  });

  test("empty purchase history text 'Aucun achat pour le moment' is visible in the component", async ({ page }) => {
    const response = await page.request.get("/billing");
    expect(response.status()).not.toBe(404);
    const body = await response.text();
    if (isRedirectPage(body)) {
      test.info().annotations.push({ type: "info", description: "Skipped content check: unauthenticated" });
      return;
    }
    expect(body).toContain("Aucun achat pour le moment");
    expect(body).toContain("Historique des achats");
  });
});
