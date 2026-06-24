import { test, expect } from "@playwright/test";

test.describe("Admin blocked numbers page", () => {
  test("page heading Numéros bloqués is visible when authenticated", async ({ page }) => {
    await page.goto("/admin/blocked-numbers");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");
    if (!isLoggedIn) return;

    await expect(
      page.getByRole("heading", { name: "Numéros bloqués" }),
    ).toBeVisible();
  });

  test("subtitle description is visible", async ({ page }) => {
    await page.goto("/admin/blocked-numbers");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");
    if (!isLoggedIn) return;

    await expect(
      page.getByText("Gérez la liste des numéros de téléphone bloqués"),
    ).toBeVisible();
  });

  test("block form has phone input with correct placeholder", async ({ page }) => {
    await page.goto("/admin/blocked-numbers");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");
    if (!isLoggedIn) return;

    await expect(
      page.getByPlaceholder("+33612345678"),
    ).toBeVisible();
  });

  test("block form has reason input with correct placeholder", async ({ page }) => {
    await page.goto("/admin/blocked-numbers");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");
    if (!isLoggedIn) return;

    await expect(
      page.getByPlaceholder("Motif (optionnel)"),
    ).toBeVisible();
  });

  test("block button Bloquer with Ban icon is visible", async ({ page }) => {
    await page.goto("/admin/blocked-numbers");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");
    if (!isLoggedIn) return;

    const blockBtn = page.getByRole("button", { name: "Bloquer" });
    await expect(blockBtn).toBeVisible();
    // Ban icon renders as an SVG inside the button
    await expect(blockBtn.locator("svg")).toBeVisible();
  });

  test("block form submit button is disabled when phone is empty", async ({ page }) => {
    await page.goto("/admin/blocked-numbers");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");
    if (!isLoggedIn) return;

    await expect(
      page.getByRole("button", { name: "Bloquer" }),
    ).toBeDisabled();
  });

  test("Numéros bloqués section heading is visible", async ({ page }) => {
    await page.goto("/admin/blocked-numbers");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");
    if (!isLoggedIn) return;

    // CardTitle renders as <h3> — the second "Numéros bloqués" heading on the page
    await expect(
      page.locator("h3").filter({ hasText: "Numéros bloqués" }),
    ).toBeVisible();
  });

  test("empty state Aucun numéro bloqué pour le moment is visible when list empty", async ({ page }) => {
    await page.goto("/admin/blocked-numbers");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");
    if (!isLoggedIn) return;

    const unblockBtns = page.getByRole("button", { name: "Débloquer" });
    const hasItems = (await unblockBtns.count()) > 0;

    test.skip(hasItems, "Skipping: blocked numbers list has items, cannot verify empty state");
    if (hasItems) return;

    await expect(
      page.getByText("Aucun numéro bloqué pour le moment."),
    ).toBeVisible();
  });

  test("unblock button Débloquer with Unlock icon is present on items", async ({ page }) => {
    await page.goto("/admin/blocked-numbers");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");
    if (!isLoggedIn) return;

    const unblockBtns = page.getByRole("button", { name: "Débloquer" });
    const hasItems = (await unblockBtns.count()) > 0;

    test.skip(!hasItems, "Skipping: no blocked numbers in the list");
    if (!hasItems) return;

    await expect(unblockBtns.first()).toBeVisible();
    // Unlock icon renders as an SVG inside the button
    await expect(unblockBtns.first().locator("svg")).toBeVisible();
  });
});
