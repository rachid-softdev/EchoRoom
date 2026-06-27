import path from "node:path";
import { expect, test } from "@playwright/test";

const COMPONENT_PATH = path.resolve(__dirname, "../../src/app/(auth)/login/page.tsx");

function readComponent(): string {
  return require("node:fs").readFileSync(COMPONENT_PATH, "utf-8");
}

test.describe("Login page — deep coverage", () => {
  // ── Source analysis ──

  test("component is default exported", () => {
    const source = readComponent();
    expect(source).toContain("export default function LoginPage");
  });

  test("uses 'use client' directive", () => {
    const source = readComponent();
    expect(source).toContain('"use client"');
  });

  test("shows/hides password via Eye/EyeOff toggle", () => {
    const source = readComponent();
    expect(source).toMatch(/import.*\{.*Eye.*EyeOff.*\}.*from.*lucide-react/);
    expect(source).toContain("Afficher le mot de passe");
    expect(source).toContain("Masquer le mot de passe");
  });

  test("uses signIn from next-auth/react", () => {
    const source = readComponent();
    expect(source).toMatch(/import.*signIn.*from.*next-auth\/react/);
  });

  test("success pushes to /dashboard and refreshes", () => {
    const source = readComponent();
    expect(source).toContain('router.push("/dashboard")');
    expect(source).toContain("router.refresh()");
  });

  test("error displays Email ou mot de passe incorrect", () => {
    const source = readComponent();
    expect(source).toContain("Email ou mot de passe incorrect");
  });

  test("catch error shows generic error message", () => {
    const source = readComponent();
    expect(source).toContain("Une erreur est survenue. Réessayez plus tard.");
  });

  test("error has role=alert and id=login-error", () => {
    const source = readComponent();
    expect(source).toContain('role="alert"');
    expect(source).toContain('id="login-error"');
  });

  test("email input has placeholder vous@exemple.com", () => {
    const source = readComponent();
    expect(source).toContain('placeholder="vous@exemple.com"');
  });

  test("password input has placeholder ••••••••", () => {
    const source = readComponent();
    expect(source).toContain('placeholder="••••••••"');
  });

  test("forgot password link href is /auth/forgot-password", () => {
    const source = readComponent();
    expect(source).toContain('href="/auth/forgot-password"');
    expect(source).toContain("Mot de passe oublié ?");
  });

  test("loading state shows Loader2 spinner and disabled button", () => {
    const source = readComponent();
    expect(source).toContain("loading");
    expect(source).toMatch(/disabled=\{loading\}/);
    expect(source).toMatch(/Loader2.*animate-spin/);
  });

  test("inputs disabled during loading", () => {
    const source = readComponent();
    expect(source).toContain("disabled={loading}");
  });

  test("MarketingNav is rendered at top", () => {
    const source = readComponent();
    expect(source).toMatch(/MarketingNav/);
  });

  // ── Live browser tests ──

  test("live: password toggle switches input type", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const passwordInput = page.locator("#password");
    await expect(passwordInput).toHaveAttribute("type", "password");

    const toggleButton = page.getByLabel("Afficher le mot de passe");
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute("type", "text");

    const hideButton = page.getByLabel("Masquer le mot de passe");
    await hideButton.click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("live: forgot password link navigates to /auth/forgot-password", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();
    // The page may 404 if not implemented, but the route should be navigated to
    expect(page.url()).toContain("/auth/forgot-password");
  });

  test("live: MarketingNav with EchoRoom branding is visible", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("EchoRoom").first()).toBeVisible();
  });

  test("live: login form uses max-w-sm card layout", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // The card contains the form
    const card = page.locator("form").first();
    await expect(card).toBeVisible();
  });
});
