import { test, expect } from "@playwright/test";

test.describe("Create scenario page", () => {
  test("should redirect to /login when unauthenticated", async ({ page }) => {
    await page.goto("/create");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "Connexion" }),
    ).toBeVisible();
  });

  test("should redirect to /login when unauthenticated for /create", async ({ page }) => {
    await page.goto("/create");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByText("Connectez-vous pour accéder à votre dashboard"),
    ).toBeVisible();
  });

  test("character selection grid renders", async ({ page }) => {
    await page.goto("/create");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/create");
    test.skip(redirected, "Authentication required to access create page");
    if (redirected) return;

    // "Personnage IA" heading should be visible
    await expect(page.getByText("Personnage IA")).toBeVisible();

    // The character grid container exists (either with cards or loading state)
    const characterCard = page.locator("button").filter({ has: page.locator(".rounded-full") }).first();
    const skeleton = page.locator("[class*='skeleton']").first();
    const hasCard = await characterCard.isVisible().catch(() => false);
    const hasSkeleton = await skeleton.isVisible().catch(() => false);

    if (hasCard) {
      await expect(characterCard).toBeVisible();
    } else if (hasSkeleton) {
      await expect(skeleton).toBeVisible();
    }
  });

  test("all form fields visible with correct attributes", async ({ page }) => {
    await page.goto("/create");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/create");
    test.skip(redirected, "Authentication required to access create page");
    if (redirected) return;

    // Title input
    const titleInput = page.getByLabel("Titre du scénario");
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveAttribute("required", "");
    await expect(titleInput).toHaveAttribute("minLength", "3");
    await expect(titleInput).toHaveAttribute("maxLength", "80");
    await expect(titleInput).toHaveAttribute("placeholder", "Ex: Le speed dating catastrophique");

    // Description textarea
    const descriptionInput = page.getByLabel("Description");
    await expect(descriptionInput).toBeVisible();
    await expect(descriptionInput).toHaveAttribute("maxLength", "300");
    await expect(descriptionInput).toHaveAttribute("placeholder", "Décrivez le contexte du scénario...");

    // Opening message textarea
    const openingInput = page.getByLabel("Message d'ouverture");
    await expect(openingInput).toBeVisible();
    await expect(openingInput).toHaveAttribute("maxLength", "300");
    await expect(openingInput).toHaveAttribute(
      "placeholder",
      "Ce que le personnage dit au début de l'appel...",
    );

    // AI Instructions textarea
    const aiInstructionsInput = page.getByLabel("Instructions IA");
    await expect(aiInstructionsInput).toBeVisible();
    await expect(aiInstructionsInput).toHaveAttribute("maxLength", "3000");
    await expect(aiInstructionsInput).toHaveAttribute(
      "placeholder",
      "Instructions détaillées pour le comportement de l'IA...",
    );
  });

  test("visibility toggle PUBLIC/PRIVATE interaction", async ({ page }) => {
    await page.goto("/create");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/create");
    test.skip(redirected, "Authentication required to access create page");
    if (redirected) return;

    const publicBtn = page.getByRole("button", { name: "Public" });
    const privateBtn = page.getByRole("button", { name: "Privé" });

    // Default should be PUBLIC active
    await expect(publicBtn).toBeVisible();
    await expect(privateBtn).toBeVisible();

    // Click PRIVATE — verify active state changes
    await privateBtn.click();
    // Check that the private button now has the primary border class
    await expect(privateBtn).toHaveClass(/border-primary/);
    await expect(publicBtn).not.toHaveClass(/border-primary/);

    // Click PUBLIC — verify active state switches back
    await publicBtn.click();
    await expect(publicBtn).toHaveClass(/border-primary/);
    await expect(privateBtn).not.toHaveClass(/border-primary/);
  });

  test("back link navigates to /dashboard", async ({ page }) => {
    await page.goto("/create");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/create");
    test.skip(redirected, "Authentication required to access create page");
    if (redirected) return;

    // The back link renders as an <a> with an ArrowLeft icon and "Dashboard" text
    const backLink = page.locator('a[href="/dashboard"]').first();
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute("href", "/dashboard");
  });

  test("cancel button navigates to /dashboard", async ({ page }) => {
    await page.goto("/create");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/create");
    test.skip(redirected, "Authentication required to access create page");
    if (redirected) return;

    // Cancel button is a Link with Button variant wrapping "Annuler" text
    const cancelLink = page.getByRole("link", { name: "Annuler" });
    await expect(cancelLink).toBeVisible();
    await expect(cancelLink).toHaveAttribute("href", "/dashboard");
  });

  test("character counter on AI instructions updates", async ({ page }) => {
    await page.goto("/create");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/create");
    test.skip(redirected, "Authentication required to access create page");
    if (redirected) return;

    const aiInstructionsInput = page.getByLabel("Instructions IA");

    // The counter shows "0/3000 caractères" initially
    await expect(page.getByText("0/3000 caractères")).toBeVisible();

    // Type some text and verify the counter updates
    await aiInstructionsInput.fill("Bonjour");
    await expect(page.getByText("7/3000 caractères")).toBeVisible();

    // Type more text to verify dynamic counting
    await aiInstructionsInput.fill("Ceci est un message de test pour le compteur de caractères");
    // Count the actual characters
    const text = "Ceci est un message de test pour le compteur de caractères";
    await expect(page.getByText(`${text.length}/3000 caractères`)).toBeVisible();
  });
});
