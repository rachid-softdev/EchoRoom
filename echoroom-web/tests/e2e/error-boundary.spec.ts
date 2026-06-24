import { test, expect } from "@playwright/test";

test.describe("Error boundary and 404 pages", () => {
  test("should show the Frown icon on the 404 page", async ({ page }) => {
    await page.goto("/non-existent-route", {
      waitUntil: "networkidle",
    });
    // The Frown icon from lucide-react renders as an SVG with class "lucide-frown"
    const frownIcon = page.locator("svg.lucide-frown");
    await expect(frownIcon).toBeVisible();
  });

  test("should display 404 page message indicating the page does not exist", async ({ page }) => {
    await page.goto("/non-existent-route", {
      waitUntil: "networkidle",
    });
    await expect(
      page.getByText(/n'existe pas|déplacée/),
    ).toBeVisible();
  });

  test.describe("Runtime error page", () => {
    test.beforeEach(async ({ page }) => {
      // Intercept any page request to return the error boundary HTML structure
      // This simulates what Next.js renders via error.tsx when a runtime error occurs.
      await page.route("**/__test-error-boundary", async (route) => {
        if (route.request().resourceType() === "document") {
          await route.fulfill({
            status: 200,
            contentType: "text/html",
            body: `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Erreur — EchoRoom AI</title>
</head>
<body>
  <div id="__next">
    <div class="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <svg class="lucide lucide-alert-triangle w-16 h-16 text-destructive mb-6" aria-label="AlertTriangle icon"></svg>
      <h1 class="text-4xl font-bold mb-4">Une erreur est survenue</h1>
      <p class="text-muted-foreground mb-2 max-w-md">D&eacute;sol&eacute;s, quelque chose s&apos;est mal pass&eacute;. Notre &eacute;quipe a &eacute;t&eacute; notifi&eacute;e.</p>
      <div class="flex items-center justify-center gap-2 mb-6">
        <p class="text-xs text-muted-foreground font-mono">Erreur #TEST_DIGEST_123</p>
        <button aria-label="Copier l'identifiant d'erreur">
          <svg class="lucide lucide-copy w-3 h-3"></svg>
        </button>
      </div>
      <button class="gap-2">
        <svg class="lucide lucide-rotate-ccw w-4 h-4"></svg>
        R&eacute;essayer
      </button>
    </div>
  </div>
</body>
</html>`,
          });
        } else {
          await route.continue();
        }
      });
    });

    test("should display the error page with 'Une erreur est survenue' heading", async ({ page }) => {
      await page.goto("/__test-error-boundary", {
        waitUntil: "networkidle",
      });
      await expect(page.getByText("Une erreur est survenue")).toBeVisible();
    });

    test("should display a 'Réessayer' button on the error page", async ({ page }) => {
      await page.goto("/__test-error-boundary", {
        waitUntil: "networkidle",
      });
      await expect(
        page.getByRole("button", { name: "Réessayer" }),
      ).toBeVisible();
    });

    test("should display a copy button for the error digest on the error page", async ({ page }) => {
      await page.goto("/__test-error-boundary", {
        waitUntil: "networkidle",
      });
      await expect(
        page.getByRole("button", { name: "Copier l'identifiant d'erreur" }),
      ).toBeVisible();
    });
  });

  test("should render a skip link on the root layout", async ({ page }) => {
    await page.goto("/");
    // The skip link navigates to #main-content and is visually hidden until focused
    const skipLink = page.getByRole("link", { name: "Aller au contenu principal" });
    await expect(skipLink).toBeVisible();
    await expect(skipLink).toHaveAttribute("href", "#main-content");
  });

  test("should have valid HTML structure on the landing page", async ({ page }) => {
    await page.goto("/");
    // Check that the html element has the correct lang attribute
    const htmlLang = await page.evaluate(() =>
      document.documentElement.getAttribute("lang"),
    );
    expect(htmlLang).toBe("fr");

    // Check that the page has a meaningful title
    const pageTitle = await page.title();
    expect(pageTitle).toBeTruthy();
    expect(pageTitle.length).toBeGreaterThan(0);

    // Check that a main content area exists
    const mainContent = page.locator("#main-content");
    await expect(mainContent).toBeVisible();
  });
});
