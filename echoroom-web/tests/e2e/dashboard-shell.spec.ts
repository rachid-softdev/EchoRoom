import { test, expect } from "@playwright/test";
import path from "path";

const COMPONENT_PATH = path.resolve(
  __dirname,
  "../../src/components/shared/DashboardShell.tsx",
);

function readComponent(): string {
  return require("fs").readFileSync(COMPONENT_PATH, "utf-8");
}

test.describe("DashboardShell component", () => {
  // ── Source analysis (structural) ──

  test("component is exported as a named export", () => {
    const source = readComponent();
    expect(source).toContain("export function DashboardShell");
  });

  test("uses 'use client' directive", () => {
    const source = readComponent();
    expect(source).toContain("'use client'");
  });

  test("uses next/navigation usePathname for active state", () => {
    const source = readComponent();
    expect(source).toMatch(/import.*usePathname.*from\s+["']next\/navigation["']/);
    expect(source).toContain("const pathname = usePathname()");
  });

  test("has 7 nav links defined", () => {
    const source = readComponent();
    // Count the navLinks array entries
    const matches = source.match(/\{ href:/g);
    expect(matches).toBeTruthy();
    expect(matches!.length).toBeGreaterThanOrEqual(7);
  });

  test("nav links cover all dashboard routes", () => {
    const source = readComponent();
    expect(source).toContain("/dashboard");
    expect(source).toContain("/create");
    expect(source).toContain("/library");
    expect(source).toContain("/history");
    expect(source).toContain("/community");
    expect(source).toContain("/leaderboard");
    expect(source).toContain("/billing");
  });

  test("nav link has aria-current=\"page\" for active state", () => {
    const source = readComponent();
    expect(source).toContain('aria-current={isActive ? "page" : undefined}');
  });

  test("nav link label is hidden on mobile via hidden sm:inline", () => {
    const source = readComponent();
    expect(source).toContain('<span className="hidden sm:inline">{link.label}</span>');
  });

  test("CreditDisplay is rendered in the nav", () => {
    const source = readComponent();
    expect(source).toContain("<CreditDisplay");
    expect(source).toMatch(/import.*CreditDisplay/);
  });

  test("ThemeToggle is rendered in the nav", () => {
    const source = readComponent();
    expect(source).toContain("<ThemeToggle");
    expect(source).toMatch(/import.*ThemeToggle/);
  });

  test("Settings link with gear icon is present", () => {
    const source = readComponent();
    expect(source).toContain('/settings');
    expect(source).toMatch(/Settings.*w-4 h-4/);
  });

  test("page has sticky top-0 nav with backdrop blur", () => {
    const source = readComponent();
    expect(source).toContain("sticky top-0 z-40");
    expect(source).toContain("backdrop-blur-sm");
  });

  test("title rendered as h1 with text-3xl font-bold", () => {
    const source = readComponent();
    expect(source).toContain('<h1 className="text-3xl font-bold mb-2">{title}</h1>');
  });

  test("subtitle rendered conditionally", () => {
    const source = readComponent();
    expect(source).toContain('{subtitle && <p className="text-muted-foreground">{subtitle}</p>}');
  });

  // ── Live browser test on dashboard page ──

  test("live: nav links are visible on dashboard page when authenticated", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requires authentication");
    if (redirected) return;

    // Check brand
    await expect(page.getByText("EchoRoom")).toBeVisible();

    // Check key nav labels are visible (desktop)
    await expect(page.getByText("Dashboard").first()).toBeVisible();
    await expect(page.getByText("Créer").first()).toBeVisible();
    await expect(page.getByText("Bibliothèque").first()).toBeVisible();
    await expect(page.getByText("Historique").first()).toBeVisible();
    await expect(page.getByText("Communauté").first()).toBeVisible();
    await expect(page.getByText("Classement").first()).toBeVisible();
    await expect(page.getByText("Facturation").first()).toBeVisible();

    // Check title is visible
    await expect(page.locator("h1")).toBeVisible();
  });
});
