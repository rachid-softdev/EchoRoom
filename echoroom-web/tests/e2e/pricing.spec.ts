import { test, expect } from "@playwright/test";

test.describe("Pricing page", () => {
  test("should load the pricing page with Tarifs badge", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByText("Tarifs")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /crédit.*appel/ }),
    ).toBeVisible();
  });

  test("should display all plan cards (Découverte, Starter, Pro)", async ({ page }) => {
    await page.goto("/pricing");
    await page.waitForLoadState("networkidle");

    // Check that the three plan names are visible
    await expect(page.getByText("Découverte")).toBeVisible();
    await expect(page.getByText("Starter")).toBeVisible();
    await expect(page.getByText("Pro")).toBeVisible();

    // Check pricing labels
    await expect(page.getByText("Gratuit")).toBeVisible();
  });

  test("should show CTA link for the free plan that navigates to register", async ({ page }) => {
    await page.goto("/pricing");
    await page.waitForLoadState("networkidle");

    // The free plan (Découverte) has a CTA button linking to /register
    const commencerButton = page.getByRole("link", { name: "Commencer" });
    await expect(commencerButton).toBeVisible();
    await expect(commencerButton).toHaveAttribute("href", "/register");
  });

  test("should display feature comparisons for each plan", async ({ page }) => {
    await page.goto("/pricing");
    await page.waitForLoadState("networkidle");

    // Check that features from the free plan are listed
    await expect(page.getByText("5 crédits offerts")).toBeVisible();
    await expect(page.getByText("8 personnages IA")).toBeVisible();
    await expect(page.getByText("Accès à la bibliothèque")).toBeVisible();
    await expect(page.getByText("Feed communautaire")).toBeVisible();

    // Check that Starter features are visible
    await expect(page.getByText("50 crédits")).toBeVisible();

    // Check that Pro features are visible
    await expect(page.getByText("200 crédits")).toBeVisible();
    await expect(page.getByText("Support prioritaire")).toBeVisible();
  });
});
