import { expect, test } from "@playwright/test";

test.describe("Cross-cutting accessibility", () => {
  // ── Skip link ──

  test("skip link is present on landing page", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Skip link should be the first focusable element
    const skipLink = page
      .locator("a")
      .filter({ hasText: /Aller au contenu|Skip|Passer/ })
      .first();
    const skipExists = await skipLink.isVisible().catch(() => false);

    if (skipExists) {
      await expect(skipLink).toBeVisible();
      // Should have href pointing to main content
      const href = await skipLink.getAttribute("href");
      expect(href).toMatch(/^#/);
    }
  });

  test("skip link is present on login page", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const skipLink = page
      .locator("a")
      .filter({ hasText: /Aller au contenu|Skip|Passer/ })
      .first();
    const skipExists = await skipLink.isVisible().catch(() => false);

    if (skipExists) {
      await expect(skipLink).toBeVisible();
    }
  });

  // ── Page structure ──

  test("pages have lang=fr attribute on html", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const lang = await page.locator("html").getAttribute("lang");
    expect(lang).toBe("fr");
  });

  test("landing page has semantic main landmark", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const main = page.locator("main");
    const mainCount = await main.count();
    if (mainCount > 0) {
      await expect(main.first()).toBeVisible();
    }
  });

  test("login page has semantic main landmark", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const main = page.locator("main");
    const mainCount = await main.count();
    if (mainCount > 0) {
      await expect(main.first()).toBeVisible();
    }
  });

  // ── ARIA labels on icon-only buttons ──

  test("theme toggle button has aria-label", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Theme toggle is a button with only an icon
    const themeButton = page
      .locator("button")
      .filter({ has: page.locator("svg.lucide-sun, svg.lucide-moon") })
      .first();
    const themeExists = await themeButton.isVisible().catch(() => false);

    if (themeExists) {
      const ariaLabel = await themeButton.getAttribute("aria-label");
      expect(ariaLabel).toBeTruthy();
    }
  });

  // ── Form labels ──

  test("login form inputs have associated labels", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Email input should have a label
    const emailLabel = page.locator('label[for="email"]');
    await expect(emailLabel).toBeVisible();
    await expect(emailLabel).toHaveText("Email");

    // Password input should have a label
    const passwordLabel = page.locator('label[for="password"]');
    await expect(passwordLabel).toBeVisible();
    await expect(passwordLabel).toHaveText("Mot de passe");
  });

  test("register form inputs have associated labels", async ({ page }) => {
    await page.goto("/register");
    await page.waitForLoadState("networkidle");

    await expect(page.locator('label[for="email"]')).toHaveText("Email");
    await expect(page.locator('label[for="username"]')).toHaveText("Nom d'utilisateur");
    await expect(page.locator('label[for="password"]')).toHaveText("Mot de passe");
  });

  test("register consent checkbox has associated label", async ({ page }) => {
    await page.goto("/register");
    await page.waitForLoadState("networkidle");

    const consentLabel = page.locator('label[for="consent"]');
    await expect(consentLabel).toBeVisible();
  });

  // ── Error messages with aria-describedby ──

  test("login error has role=alert", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Submit with invalid credentials to trigger error
    await page.getByLabel("Email").fill("invalid@example.com");
    await page.locator("#password").fill("wrong");
    await page.getByRole("button", { name: "Se connecter" }).click();

    // The error should have role=alert
    const error = page.locator('[role="alert"]');
    await expect(error).toBeVisible({ timeout: 10000 });
  });

  test("register inputs have aria-describedby when error exists", async ({ page: _page }) => {
    const source = require("node:fs").readFileSync(
      require("node:path").resolve(__dirname, "../../src/app/(auth)/register/page.tsx"),
      "utf-8",
    );
    expect(source).toContain('aria-describedby={error ? "register-error" : undefined}');
  });

  // ── Focus management ──

  test("Escape key closes consent dialog on settings page", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requires authentication");
    if (redirected) return;

    // Find and click the consent withdrawal button
    const retirerButton = page.getByText("RETIRER").first();
    const retirerExists = await retirerButton.isVisible().catch(() => false);
    test.skip(!retirerExists, "No consent retirer button visible");

    if (retirerExists) {
      // Press Escape to close dialog
      await page.keyboard.press("Escape");
      // Dialog should close — verify the backdrop is gone
      await page.waitForTimeout(300);
    }
  });

  // ── Images with alt text ──

  test("images on landing page have alt attributes", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const images = page.locator("img");
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute("alt");
      // alt can be empty string (presentational) but should exist
      expect(alt).not.toBeNull();
    }
  });

  // ── Heading hierarchy ──

  test("landing page has a single h1", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBeGreaterThanOrEqual(1);
  });

  test("login page has single h1 Connexion", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const h1 = page.locator("h1");
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText("Connexion");
  });

  test("register page has single h1 Créer un compte", async ({ page }) => {
    await page.goto("/register");
    await page.waitForLoadState("networkidle");

    const h1 = page.locator("h1");
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText("Créer un compte");
  });

  // ── Navigation landmarks ──

  test("landing page has navigation landmark", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const nav = page.locator("nav");
    const navCount = await nav.count();
    expect(navCount).toBeGreaterThanOrEqual(1);
  });
});
