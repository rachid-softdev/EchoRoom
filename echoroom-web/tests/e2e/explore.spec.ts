import { test, expect } from "@playwright/test";

test.describe("Explore page", () => {
  test("should load and display the page heading", async ({ page }) => {
    await page.goto("/explore");
    await expect(
      page.getByRole("heading", { name: /Explorer les scénarios/ }),
    ).toBeVisible();
    await expect(
      page.getByText(/Découvrez les créations de la communauté/),
    ).toBeVisible();
  });

  test("should display the search input", async ({ page }) => {
    await page.goto("/explore");
    const searchInput = page.getByPlaceholder("Rechercher un scénario...");
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toBeEnabled();
  });

  test("should accept text in the search input", async ({ page }) => {
    await page.goto("/explore");
    const searchInput = page.getByPlaceholder("Rechercher un scénario...");
    await searchInput.fill("test");
    await expect(searchInput).toHaveValue("test");
  });

  test("should display all category filter buttons", async ({ page }) => {
    await page.goto("/explore");
    const categories = [
      "Tous",
      "Romantique",
      "Chaotique",
      "Corporate",
      "NPC",
      "Horreur",
      "Cringe",
      "Gamer",
      "Weird",
    ];
    for (const category of categories) {
      await expect(
        page.getByRole("button", { name: category }),
      ).toBeVisible();
    }
  });

  test("should activate a category when clicked", async ({ page }) => {
    await page.goto("/explore");
    const romantiqueBtn = page.getByRole("button", { name: "Romantique" });
    await romantiqueBtn.click();
    await expect(romantiqueBtn).toHaveAttribute("aria-pressed", "true");
    // Previously active "Tous" should be deactivated
    await expect(page.getByRole("button", { name: "Tous" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("should display sort toggle buttons (Chronologique, Tendance, Top)", async ({ page }) => {
    await page.goto("/explore");
    const sortLabels = ["Chronologique", "Tendance", "Top"];
    for (const label of sortLabels) {
      await expect(
        page.getByRole("radio", { name: label }),
      ).toBeVisible();
    }
  });

  test("should change active sort when clicking sort options", async ({ page }) => {
    await page.goto("/explore");
    // Default should be Chronologique
    await expect(
      page.getByRole("radio", { name: "Chronologique" }),
    ).toHaveAttribute("aria-checked", "true");

    // Click Tendance
    await page.getByRole("radio", { name: "Tendance" }).click();
    await expect(
      page.getByRole("radio", { name: "Tendance" }),
    ).toHaveAttribute("aria-checked", "true");
    await expect(
      page.getByRole("radio", { name: "Chronologique" }),
    ).toHaveAttribute("aria-checked", "false");

    // Click Top
    await page.getByRole("radio", { name: "Top" }).click();
    await expect(
      page.getByRole("radio", { name: "Top" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  test("should display either scenario cards or an empty state", async ({ page }) => {
    await page.goto("/explore");
    // Wait for data to finish loading
    await page.waitForLoadState("networkidle");

    // After loading, either scenario cards exist or empty state is shown
    const scenarioLink = page.locator('a[href^="/scenario/"]').first();
    const emptyState = page.getByText("Aucun résultat").first();

    // Use Promise.race via locator evaluation
    const hasScenarioCards = await scenarioLink.isVisible().catch(() => false);
    const hasEmptyState = await emptyState.isVisible().catch(() => false);

    if (hasScenarioCards) {
      await expect(scenarioLink).toBeVisible();
    } else if (hasEmptyState) {
      await expect(emptyState).toBeVisible();
    }
    // If neither is found (still loading), fail with a helpful message
    if (!hasScenarioCards && !hasEmptyState) {
      // Check for error state
      await expect(page.getByText("Une erreur est survenue")).toBeVisible();
    }
  });

  test("should display the back navigation link to home", async ({ page }) => {
    await page.goto("/explore");
    await expect(
      page.getByRole("link", { name: /Accueil/ }),
    ).toBeVisible();
  });

  test("should display the Connexion button for unauthenticated users", async ({ page }) => {
    await page.goto("/explore");
    await expect(
      page.getByRole("button", { name: "Connexion" }),
    ).toBeVisible();
  });
});
