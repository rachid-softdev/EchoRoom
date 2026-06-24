import { test, expect } from "@playwright/test";

test.describe("Theme toggle", () => {
  test("should display the theme toggle button with theme-related aria-label on the landing page", async ({ page }) => {
    await page.goto("/");
    // The ThemeToggle button has aria-label "Charger le thème" before hydration
    // and "Changer le thème" after hydration. Accept either value since we
    // cannot guarantee hydration timing.
    const themeButton = page.getByRole("button", { name: /Charger le thème|Changer le thème/ });
    await expect(themeButton).toBeVisible();
  });

  test("should load the landing page without theme-related console errors", async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Filter out known non-theme errors
    const themeErrors = consoleErrors.filter(
      (e) =>
        e.toLowerCase().includes("theme") ||
        e.toLowerCase().includes("dark") ||
        e.toLowerCase().includes("light") ||
        e.toLowerCase().includes("next-themes"),
    );
    expect(themeErrors).toEqual([]);
  });
});
