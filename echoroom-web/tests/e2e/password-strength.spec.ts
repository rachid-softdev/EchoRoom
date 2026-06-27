import { expect, test } from "@playwright/test";

test.describe("PasswordStrengthMeter component", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/register");
    await page.waitForLoadState("networkidle");
  });

  test("hidden when password is empty", async ({ page }) => {
    const passwordInput = page.locator("#password");
    await expect(passwordInput).toBeVisible();

    // With empty password, the strength meter should not be rendered
    // (the component returns null when password is "")
    const strengthMeter = page.locator("text=Force :");
    await expect(strengthMeter).toHaveCount(0);
  });

  test("renders 5 segment bars when password has content", async ({ page }) => {
    const passwordInput = page.locator("#password");
    await passwordInput.fill("abc");

    // The 5 bars have classes h-1.5 and flex-1
    const bars = page.locator('[class*="h-1.5"][class*="flex-1"]');
    await expect(bars).toHaveCount(5);
  });

  test("colored bars appear for filled segments", async ({ page }) => {
    const passwordInput = page.locator("#password");

    // A strong password should produce 5 filled bars (score = 5)
    await passwordInput.fill("Abcdef1!@#$");

    // Each filled bar gets its color class from COLORS array:
    // bg-destructive, bg-orange-500, bg-yellow-500, bg-lime-500, bg-green-500
    const bars = page.locator('[class*="h-1.5"][class*="flex-1"]');

    // At minimum, the first bar should be filled (bg-destructive)
    // We verify by checking at least one bar has a non-muted background
    const coloredBars = bars.locator(
      '[class*="bg-destructive"], [class*="bg-orange-500"], [class*="bg-yellow-500"], [class*="bg-lime-500"], [class*="bg-green-500"]',
    );
    const coloredCount = await coloredBars.count();
    expect(coloredCount).toBeGreaterThanOrEqual(5);

    // Verify each color class is used for its corresponding index
    // Score 5 means all 5 bars are filled, each with its respective color
    await expect(bars.nth(0)).toHaveClass(/bg-destructive/);
    await expect(bars.nth(1)).toHaveClass(/bg-orange-500/);
    await expect(bars.nth(2)).toHaveClass(/bg-yellow-500/);
    await expect(bars.nth(3)).toHaveClass(/bg-lime-500/);
    await expect(bars.nth(4)).toHaveClass(/bg-green-500/);
  });

  test("displays correct strength label: Force : {label}", async ({ page }) => {
    const passwordInput = page.locator("#password");

    // Score 0 → "Très faible"
    await passwordInput.fill("a");
    await expect(page.getByText("Force : Très faible")).toBeVisible();

    // Score 1 → "Faible"
    await passwordInput.fill("abcdefgh");
    await expect(page.getByText("Force : Faible")).toBeVisible();

    // Score 2 → "Moyen"
    await passwordInput.fill("abcdefgh1");
    await expect(page.getByText("Force : Moyen")).toBeVisible();

    // Score 3 → "Fort"
    await passwordInput.fill("Abcdefgh1");
    await expect(page.getByText("Force : Fort")).toBeVisible();

    // Score 4 → "Très fort"
    await passwordInput.fill("Abcdef1!@");
    await expect(page.getByText("Force : Très fort")).toBeVisible();

    // Score 5 → "Très fort" (capped at last label)
    await passwordInput.fill("Abcdef1!@#$");
    await expect(page.getByText("Force : Très fort")).toBeVisible();
  });

  test("shows check mark for 8+ characters", async ({ page }) => {
    const passwordInput = page.locator("#password");

    // Less than 8 chars → no check
    await passwordInput.fill("abc");
    const check8 = page.getByText("8 caractères minimum");
    // The check mark span before the text should be ✓ (green) or ✗ (destructive)
    await expect(check8.locator("xpath=..").locator("span").first()).toHaveClass(
      /text-destructive/,
    );

    // 8 chars → check mark
    await passwordInput.fill("abcdefgh");
    await expect(check8.locator("xpath=..").locator("span").first()).toHaveClass(/text-green-500/);
  });

  test("shows check mark for 12+ characters", async ({ page }) => {
    const passwordInput = page.locator("#password");

    // Less than 12 chars → no check
    await passwordInput.fill("abcdefgh");
    const check12 = page.getByText("12 caractères minimum");
    await expect(check12.locator("xpath=..").locator("span").first()).toHaveClass(
      /text-destructive/,
    );

    // 12 chars → check mark
    await passwordInput.fill("abcdefghijkl");
    await expect(check12.locator("xpath=..").locator("span").first()).toHaveClass(/text-green-500/);
  });

  test("shows check mark for uppercase letter", async ({ page }) => {
    const passwordInput = page.locator("#password");

    // No uppercase → ✗
    await passwordInput.fill("abcdefgh1");
    const upperCheck = page.getByText("Une lettre majuscule");
    await expect(upperCheck.locator("xpath=..").locator("span").first()).toHaveClass(
      /text-destructive/,
    );

    // With uppercase → ✓
    await passwordInput.fill("Abcdefgh1");
    await expect(upperCheck.locator("xpath=..").locator("span").first()).toHaveClass(
      /text-green-500/,
    );
  });

  test("shows check mark for digit", async ({ page }) => {
    const passwordInput = page.locator("#password");

    // No digit → ✗
    await passwordInput.fill("abcdefgh");
    const digitCheck = page.getByText("Un chiffre");
    await expect(digitCheck.locator("xpath=..").locator("span").first()).toHaveClass(
      /text-destructive/,
    );

    // With digit → ✓
    await passwordInput.fill("abcdefgh1");
    await expect(digitCheck.locator("xpath=..").locator("span").first()).toHaveClass(
      /text-green-500/,
    );
  });

  test("shows check mark for special character", async ({ page }) => {
    const passwordInput = page.locator("#password");

    // No special char → ✗
    await passwordInput.fill("Abcdefgh1");
    const specialCheck = page.getByText("Un caractère spécial");
    await expect(specialCheck.locator("xpath=..").locator("span").first()).toHaveClass(
      /text-destructive/,
    );

    // With special char → ✓
    await passwordInput.fill("Abcdef1!@");
    await expect(specialCheck.locator("xpath=..").locator("span").first()).toHaveClass(
      /text-green-500/,
    );
  });

  test("shows cross for failed checks", async ({ page }) => {
    const passwordInput = page.locator("#password");
    await passwordInput.fill("abc");

    // All 5 checks should fail with this weak password
    // We verify each check's preceding span has text-destructive class
    const checks = page.locator("ul > li");
    const count = await checks.count();
    expect(count).toBe(5);

    for (let i = 0; i < count; i++) {
      const iconSpan = checks.nth(i).locator("span").first();
      await expect(iconSpan).toHaveClass(/text-destructive/);
      await expect(iconSpan).toHaveText("✗");
    }
  });

  test("score recalculates when password changes", async ({ page }) => {
    const passwordInput = page.locator("#password");

    // Start with weak password
    await passwordInput.fill("abc");
    await expect(page.getByText("Force : Très faible")).toBeVisible();

    // Change to a stronger password – score should update
    await passwordInput.fill("Abcdefgh1!@#");
    await expect(page.getByText("Force : Très fort")).toBeVisible();

    // Change back to weak – score should decrease
    await passwordInput.fill("a");
    await expect(page.getByText("Force : Très faible")).toBeVisible();
  });
});
