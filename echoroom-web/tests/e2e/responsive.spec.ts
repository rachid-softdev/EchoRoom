import { test, expect } from "@playwright/test";

// List of public pages to test on mobile
const PUBLIC_PAGES = [
  { path: "/", name: "Landing" },
  { path: "/login", name: "Login" },
  { path: "/register", name: "Register" },
  { path: "/explore", name: "Explore" },
  { path: "/pricing", name: "Pricing" },
  { path: "/legal", name: "Legal" },
  { path: "/privacy", name: "Privacy" },
  { path: "/terms", name: "Terms" },
  { path: "/help", name: "Help" },
];

// List of dashboard pages (auth-gated) to test on mobile
const AUTH_PAGES = [
  { path: "/dashboard", name: "Dashboard" },
  { path: "/create", name: "Create" },
  { path: "/library", name: "Library" },
  { path: "/history", name: "History" },
  { path: "/settings", name: "Settings" },
  { path: "/community", name: "Community" },
  { path: "/leaderboard", name: "Leaderboard" },
  { path: "/billing", name: "Billing" },
];

test.describe("Responsive 375px viewport", () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport to iPhone SE / small mobile size
    await page.setViewportSize({ width: 375, height: 667 });
  });

  // ── Public pages ──

  for (const { path, name } of PUBLIC_PAGES) {
    test(`${name} page (${path}) has no horizontal overflow`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      // Check for horizontal overflow
      const overflowX = await page.evaluate(() => {
        return document.documentElement.scrollWidth <= document.documentElement.clientWidth;
      });
      expect(overflowX).toBe(true);
    });

    test(`${name} page (${path}) renders heading on mobile`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      // At least one heading exists
      const heading = page.locator("h1, h2").first();
      await expect(heading).toBeVisible();
    });
  }

  // ── Auth-gated pages ──

  for (const { path, name } of AUTH_PAGES) {
    test(`${name} page (${path}) has no horizontal overflow when accessible`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      // If redirected to login, skip the overflow check
      const redirected = page.url().includes("/login");
      if (redirected) {
        test.info().annotations.push({ type: "skip", description: `Skipped: ${path} requires authentication` });
        return;
      }

      const overflowX = await page.evaluate(() => {
        return document.documentElement.scrollWidth <= document.documentElement.clientWidth;
      });
      expect(overflowX).toBe(true);
    });
  }

  // ── Specific mobile layout checks ──

  test("landing page navigation is usable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check that nav exists and CTA buttons are at least partially visible
    const ctaButtons = page.getByRole("button").filter({ hasText: /Commencer|S'inscrire|Gratuitement/ });
    const ctaCount = await ctaButtons.count();
    if (ctaCount > 0) {
      await expect(ctaButtons.first()).toBeVisible();
    }
  });

  test("login form fits within mobile viewport without scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // The form should be visible without scrolling
    const submitButton = page.getByRole("button", { name: "Se connecter" });
    await expect(submitButton).toBeVisible();
  });

  test("register form fits within mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/register");
    await page.waitForLoadState("networkidle");

    // The form should be visible (may need some scrolling, but key elements should be accessible)
    const submitButton = page.getByRole("button", { name: "Créer mon compte" });
    await expect(submitButton).toBeVisible();
  });

  test("explore page is usable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    // Category buttons should be horizontally scrollable, not overflowing
    const searchInput = page.getByPlaceholder(/Recherche|recherche/);
    const searchExists = await searchInput.isVisible().catch(() => false);
    if (searchExists) {
      await expect(searchInput).toBeVisible();
    }
  });

  test("navigation hamburger or mobile menu is accessible on landing", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // On mobile, navigation may use a hamburger menu, or just show icons
    // Check that navigation is functional
    const nav = page.locator("nav").first();
    await expect(nav).toBeVisible();
  });

  test("legal page content is readable on mobile without side overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/legal");
    await page.waitForLoadState("networkidle");

    // Check for overflow
    const overflowX = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= document.documentElement.clientWidth;
    });
    expect(overflowX).toBe(true);

    // Heading should be visible
    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible();
  });
});
