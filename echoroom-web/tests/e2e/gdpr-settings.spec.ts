import { expect, test } from "@playwright/test";

test.describe("GDPR Settings — route and page structure", () => {
  test("route /settings is handled (response < 400, not 404)", async ({ page }) => {
    const response = await page.request.get("/settings");
    expect(response.status()).not.toBe(404);
    expect(response.status()).toBeLessThan(400);
  });

  test("settings page displays Profil heading", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");

    if (isLoggedIn) {
      await expect(page.getByRole("heading", { name: "Profil" })).toBeVisible();
    }
  });

  test("settings page shows username input", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");

    if (isLoggedIn) {
      await expect(page.getByPlaceholder("Votre pseudo")).toBeVisible();
    }
  });

  test("settings page shows email input as disabled", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");

    if (isLoggedIn) {
      const emailInput = page.getByPlaceholder("vous@exemple.com");
      await expect(emailInput).toBeVisible();
      await expect(emailInput).toBeDisabled();
    }
  });

  test("settings page shows Enregistrer button", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");

    if (isLoggedIn) {
      await expect(page.getByRole("button", { name: "Enregistrer" })).toBeVisible();
    }
  });

  test("settings page displays Apparence section", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");

    if (isLoggedIn) {
      await expect(page.getByRole("heading", { name: "Apparence" })).toBeVisible();
    }
  });

  test("settings page displays Zone de danger heading", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");

    if (isLoggedIn) {
      await expect(page.getByRole("heading", { name: "Zone de danger" })).toBeVisible();
    }
  });

  test("settings page shows Exporter mes données section", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");

    if (isLoggedIn) {
      await expect(page.getByText("Exporter mes données")).toBeVisible();
    }
  });

  test("settings page shows Supprimer mon compte section", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");

    if (isLoggedIn) {
      await expect(page.getByText("Supprimer mon compte")).toBeVisible();
    }
  });
});

test.describe("GDPR Settings — delete account dialog", () => {
  test("delete account dialog opens with SUPPRIMER input", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");

    if (isLoggedIn) {
      // Open the delete dialog
      await page.getByRole("button", { name: "Supprimer" }).click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(page.getByText("Supprimer votre compte")).toBeVisible();
      await expect(page.getByText(/Tapez SUPPRIMER pour confirmer/)).toBeVisible();
      await expect(page.getByPlaceholder("SUPPRIMER")).toBeVisible();
    }
  });

  test("delete dialog confirm button is disabled initially", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");

    if (isLoggedIn) {
      // Open the delete dialog
      await page.getByRole("button", { name: "Supprimer" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();

      const confirmButton = page.getByRole("button", { name: "Supprimer définitivement" });
      await expect(confirmButton).toBeDisabled();
    }
  });

  test("typing SUPPRIMER enables the delete confirm button", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");

    if (isLoggedIn) {
      // Open the delete dialog
      await page.getByRole("button", { name: "Supprimer" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();

      const confirmButton = page.getByRole("button", { name: "Supprimer définitivement" });
      await expect(confirmButton).toBeDisabled();

      // Type the correct confirmation
      const input = page.getByPlaceholder("SUPPRIMER");
      await expect(input).toBeVisible();
      await input.fill("SUPPRIMER");

      // Confirm button should now be enabled
      await expect(confirmButton).toBeEnabled();
    }
  });

  test("typing wrong text keeps delete confirm button disabled", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");

    if (isLoggedIn) {
      // Open the delete dialog
      await page.getByRole("button", { name: "Supprimer" }).click();

      const confirmButton = page.getByRole("button", { name: "Supprimer définitivement" });
      await expect(confirmButton).toBeDisabled();

      const input = page.getByPlaceholder("SUPPRIMER");

      // Type wrong confirmation
      await input.fill("NON");
      await expect(confirmButton).toBeDisabled();

      // Type partial match
      await input.fill("SUPP");
      await expect(confirmButton).toBeDisabled();

      // Lowercase
      await input.fill("supprimer");
      await expect(confirmButton).toBeDisabled();
    }
  });

  test("Escape closes the delete account dialog", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");

    if (isLoggedIn) {
      // Open the delete dialog
      await page.getByRole("button", { name: "Supprimer" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();

      // Press Escape to close
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).not.toBeVisible();
    }
  });
});
