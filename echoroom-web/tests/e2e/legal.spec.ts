import { test, expect } from "@playwright/test";

test.describe("Legal pages", () => {
  test("/legal — Mentions légales page loads with correct heading", async ({ page }) => {
    await page.goto("/legal");
    await expect(
      page.getByRole("heading", { name: "Mentions légales" }),
    ).toBeVisible();
  });

  test("/legal — displays company info sections", async ({ page }) => {
    await page.goto("/legal");
    await expect(
      page.getByRole("heading", { name: "Éditeur" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Hébergement" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Contact" }),
    ).toBeVisible();
  });

  test("/privacy — Politique de confidentialité page loads with correct heading", async ({ page }) => {
    await page.goto("/privacy");
    await expect(
      page.getByRole("heading", { name: "Politique de confidentialité" }),
    ).toBeVisible();
  });

  test("/privacy — displays data collection and rights sections", async ({ page }) => {
    await page.goto("/privacy");
    await expect(
      page.getByRole("heading", { name: /Données collectées/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Vos droits/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Cookies/ }),
    ).toBeVisible();
  });

  test("/terms — Conditions d'utilisation page loads with correct heading", async ({ page }) => {
    await page.goto("/terms");
    await expect(
      page.getByRole("heading", { name: "Conditions d'utilisation" }),
    ).toBeVisible();
  });

  test("/terms — displays service description and key sections", async ({ page }) => {
    await page.goto("/terms");
    await expect(
      page.getByRole("heading", { name: /Description du service/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Crédits et paiements/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Propriété intellectuelle/ }),
    ).toBeVisible();
  });

  test("/help — Aide & FAQ page loads with correct heading", async ({ page }) => {
    await page.goto("/help");
    await expect(
      page.getByRole("heading", { name: "Aide & FAQ" }),
    ).toBeVisible();
  });

  test("/help — displays FAQ details/summary elements", async ({ page }) => {
    await page.goto("/help");
    // The FAQ is rendered as <details>/<summary> elements
    const detailsElements = page.locator("details");
    const count = await detailsElements.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Verify click interaction: opening a <details> reveals the answer
    const firstSummary = detailsElements.first().locator("summary");
    await expect(firstSummary).toBeVisible();
    await firstSummary.click();

    // After click, the details should be "open" (has the open attribute)
    await expect(detailsElements.first()).toHaveAttribute("open");
  });

  test("/help — clicking multiple FAQ items works sequentially", async ({ page }) => {
    await page.goto("/help");
    const detailsElements = page.locator("details");
    const count = await detailsElements.count();

    // Open each FAQ item in sequence
    for (let i = 0; i < count; i++) {
      const details = detailsElements.nth(i);
      const summary = details.locator("summary");
      await summary.click();
      await expect(details).toHaveAttribute("open");
    }
  });

  test("/help — FAQ items contain expected questions", async ({ page }) => {
    await page.goto("/help");
    const summaries = page.locator("details summary");

    await expect(summaries.first()).toHaveText("C'est quoi EchoRoom ?");
    await expect(summaries.nth(2)).toHaveText("C'est quoi les crédits ?");
    await expect(summaries.last()).toHaveText("Comment signaler un abus ?");
  });
});

test.describe("Footer legal links from landing page", () => {
  test("footer displays Aide, Conditions, and Confidentialité links", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const footer = page.locator("footer");
    await expect(footer).toBeVisible();

    await expect(footer.getByRole("link", { name: "Aide" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Conditions" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Confidentialité" })).toBeVisible();
  });

  test("footer Aide link navigates to /help", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.locator("footer").getByRole("link", { name: "Aide" }).click();
    await expect(page).toHaveURL("/help");
    await expect(
      page.getByRole("heading", { name: "Aide & FAQ" }),
    ).toBeVisible();
  });

  test("footer Conditions link navigates to /terms", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.locator("footer").getByRole("link", { name: "Conditions" }).click();
    await expect(page).toHaveURL("/terms");
    await expect(
      page.getByRole("heading", { name: "Conditions d'utilisation" }),
    ).toBeVisible();
  });

  test("footer Confidentialité link navigates to /privacy", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.locator("footer").getByRole("link", { name: "Confidentialité" }).click();
    await expect(page).toHaveURL("/privacy");
    await expect(
      page.getByRole("heading", { name: "Politique de confidentialité" }),
    ).toBeVisible();
  });
});

test.describe("Legal layout — common elements", () => {
  test("legal pages show retour à l'accueil link", async ({ page }) => {
    await page.goto("/legal");
    await expect(
      page.getByRole("link", { name: /Retour à l'accueil/ }),
    ).toBeVisible();
  });

  test("legal pages show EchoRoom branding in nav", async ({ page }) => {
    await page.goto("/privacy");
    await expect(
      page.getByRole("link", { name: "EchoRoom" }),
    ).toBeVisible();
  });
});
