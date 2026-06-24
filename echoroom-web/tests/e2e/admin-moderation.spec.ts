import { test, expect } from "@playwright/test";

test.describe("Admin moderation page", () => {
  test("page heading File de modération is visible when authenticated", async ({ page }) => {
    await page.goto("/admin/moderation");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");
    if (!isLoggedIn) return;

    await expect(
      page.getByRole("heading", { name: "File de modération" }),
    ).toBeVisible();
  });

  test("tab buttons Scénarios and Commentaires are visible", async ({ page }) => {
    await page.goto("/admin/moderation");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");
    if (!isLoggedIn) return;

    await expect(
      page.getByRole("button", { name: "Scénarios" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Commentaires" }),
    ).toBeVisible();
  });

  test("DataLoader renders content area after loading", async ({ page }) => {
    await page.goto("/admin/moderation");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");
    if (!isLoggedIn) return;

    // After loading, DataLoader shows either the empty state or the item list
    const emptyHeading = page.getByRole("heading", { name: "Tout est modéré" });
    const itemMeta = page.locator("p.text-sm.text-muted-foreground").first();
    await expect(emptyHeading.or(itemMeta)).toBeVisible({ timeout: 10000 });
  });

  test("scenario queue items display creator, date and character info", async ({ page }) => {
    await page.goto("/admin/moderation");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");
    if (!isLoggedIn) return;

    const itemMeta = page.locator("p.text-sm.text-muted-foreground").first();
    const itemCount = await page.locator("p.text-sm.text-muted-foreground").count();

    test.skip(itemCount === 0, "Skipping: no scenario items in the queue");
    if (itemCount === 0) return;

    await expect(itemMeta).toBeVisible();
    await expect(itemMeta).toContainText("par");
  });

  test("approve button with Check icon is visible on scenario items", async ({ page }) => {
    await page.goto("/admin/moderation");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");
    if (!isLoggedIn) return;

    const itemCount = await page.locator("p.text-sm.text-muted-foreground").count();
    test.skip(itemCount === 0, "Skipping: no scenario items in the queue");
    if (itemCount === 0) return;

    await expect(page.locator("button.text-green-500").first()).toBeVisible();
  });

  test("reject button with X icon is visible on scenario items", async ({ page }) => {
    await page.goto("/admin/moderation");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");
    if (!isLoggedIn) return;

    const itemCount = await page.locator("p.text-sm.text-muted-foreground").count();
    test.skip(itemCount === 0, "Skipping: no scenario items in the queue");
    if (itemCount === 0) return;

    await expect(page.locator("button.text-destructive").first()).toBeVisible();
  });

  test("empty state Tout est modéré is visible when queue is empty", async ({ page }) => {
    await page.goto("/admin/moderation");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");
    if (!isLoggedIn) return;

    const itemCount = await page.locator("p.text-sm.text-muted-foreground").count();
    test.skip(itemCount > 0, "Skipping: queue has items, cannot verify empty state");
    if (itemCount > 0) return;

    await expect(
      page.getByRole("heading", { name: "Tout est modéré" }),
    ).toBeVisible();
  });

  test("badge En attente with AlertTriangle icon is present on scenario items", async ({ page }) => {
    await page.goto("/admin/moderation");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");
    if (!isLoggedIn) return;

    const itemCount = await page.locator("p.text-sm.text-muted-foreground").count();
    test.skip(itemCount === 0, "Skipping: no scenario items in the queue");
    if (itemCount === 0) return;

    await expect(page.getByText("En attente").first()).toBeVisible();
  });
});
