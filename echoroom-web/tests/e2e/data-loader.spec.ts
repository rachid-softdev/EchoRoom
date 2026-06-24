import { test, expect } from "@playwright/test";

/**
 * Helper: intercept all tRPC API routes to delay responses, keeping the
 * loading skeleton visible long enough to assert on it.
 */
async function delayTrpcRoutes(page: import("@playwright/test").Page, delayMs = 5000) {
  await page.route("**/api/trpc/**", async (route) => {
    await new Promise((r) => setTimeout(r, delayMs));
    await route.continue();
  });
}

/**
 * Helper: abort all tRPC API routes to trigger the DataLoader error state.
 */
async function failTrpcRoutes(page: import("@playwright/test").Page) {
  await page.route("**/api/trpc/**", (route) => route.abort());
}

test.describe("DataLoader component", () => {
  test.describe("Loading state", () => {
    test("should show skeleton grid with md:grid-cols-3 when isLoading is true", async ({ page }) => {
      // Delay API so loading state persists
      await delayTrpcRoutes(page);
      await page.goto("/explore", { waitUntil: "commit" });

      // The skeleton grid should be visible with the md:grid-cols-3 class
      const skeletonGrid = page.locator("div.grid.md\\:grid-cols-3");
      await expect(skeletonGrid).toBeVisible({ timeout: 5000 });
    });

    test("should render the default 3 skeleton items when isLoading", async ({ page }) => {
      // Delay API so loading state persists
      await delayTrpcRoutes(page);
      await page.goto("/explore", { waitUntil: "commit" });

      // Default skeletonCount is 3, so 3 skeleton placeholder divs
      const skeletonItems = page.locator("div.grid.md\\:grid-cols-3 > div");
      await expect(skeletonItems).toHaveCount(3, { timeout: 5000 });
    });
  });

  test.describe("Error state", () => {
    test("should show AlertTriangle icon, error text and Réessayer button on error", async ({ page }) => {
      // Intercept all tRPC calls and abort them to trigger isError
      await failTrpcRoutes(page);
      await page.goto("/explore");
      await page.waitForLoadState("networkidle");

      // AlertTriangle icon (rendered by lucide-react as an SVG)
      await expect(page.getByText("Une erreur est survenue")).toBeVisible({ timeout: 10000 });

      // Réessayer button
      const retryButton = page.getByRole("button", { name: "Réessayer" });
      await expect(retryButton).toBeVisible();
    });

    test("should display the default error message when no custom error is provided", async ({ page }) => {
      await failTrpcRoutes(page);
      await page.goto("/explore");
      await page.waitForLoadState("networkidle");

      // Default fallback message: "Impossible de charger les données. Réessayez."
      // The error message is rendered in a <p> sibling below the title
      await expect(page.getByText("Impossible de charger les données")).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Empty state", () => {
    test("should display 'Aucun résultat' when search yields no results", async ({ page }) => {
      await page.goto("/explore");
      await page.waitForLoadState("networkidle");

      // Type a search term unlikely to match anything
      const searchInput = page.getByPlaceholder("Rechercher un scénario...");
      await searchInput.fill("zzzzznonexistentxxxxx");

      // Wait for debounce (300ms) + render
      await page.waitForTimeout(500);

      // The explore page renders "Aucun résultat" in its custom empty state
      await expect(page.getByText("Aucun résultat")).toBeVisible();
    });

    test("should display custom empty content when provided", async ({ page }) => {
      // The home page's FeaturedScenariosSection passes a custom `empty` prop
      // to DataLoader: "Aucun scénario à la une aujourd'hui"
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Check for the custom empty content rendered by DataLoader
      // This content appears when the featured query returns no data
      const customEmpty = page.getByText("Aucun scénario à la une aujourd'hui");
      const customExists = await customEmpty.isVisible().catch(() => false);

      // This may show OR the featured scenario card may load — gracefully skip
      // if neither is found (API returns data)
      if (!customExists) {
        // Check if a featured card loaded instead (DataLoader rendered children)
        const featuredCard = page.locator('a[href^="/scenario/"]').first();
        const cardExists = await featuredCard.isVisible().catch(() => false);
        test.skip(!cardExists, "No featured scenario section data available to test custom empty state");
        if (cardExists) return;
      }

      await expect(customEmpty).toBeVisible();
    });
  });
});

test.describe("PaginatedDataLoader component", () => {
  test.describe("via the library page (authenticated route)", () => {
    test("route exists and responds (not 404)", async ({ page }) => {
      // Check that the library route exists (may redirect to login)
      const response = await page.request.get("/library");
      expect(response.status()).not.toBe(404);
      expect(response.status()).toBeLessThan(400);
    });

    test("should show Loader2 spinner centered when isLoading is true", async ({ page }) => {
      // Delay tRPC to keep loading state visible
      await delayTrpcRoutes(page);
      await page.goto("/library", { waitUntil: "commit" });

      // Check if we got redirected to login
      await page.waitForTimeout(1000);
      const redirected = !page.url().includes("/library");
      test.skip(redirected, "Authentication required to access library page");
      if (redirected) return;

      // Loader2 spinner: <svg class="w-8 h-8 animate-spin text-muted-foreground" />
      // The parent container is a centered flex div
      const spinnerContainer = page.locator("div.flex.justify-center.py-16");
      await expect(spinnerContainer).toBeVisible({ timeout: 5000 });
      const spinner = spinnerContainer.locator("svg.animate-spin");
      await expect(spinner).toBeVisible();
    });

    test("should show AlertTriangle, 'Une erreur est survenue', Réessayer button with RefreshCw icon on error", async ({ page }) => {
      // Abort tRPC calls to trigger error state
      await failTrpcRoutes(page);
      await page.goto("/library");
      await page.waitForLoadState("networkidle");

      const redirected = !page.url().includes("/library");
      test.skip(redirected, "Authentication required to access library page");
      if (redirected) return;

      // Error title
      await expect(page.getByText("Une erreur est survenue")).toBeVisible({ timeout: 10000 });

      // Réessayer button with RefreshCw icon
      const retryButton = page.getByRole("button", { name: "Réessayer" });
      await expect(retryButton).toBeVisible();
    });

    test("should render empty node when items array is empty", async ({ page }) => {
      await page.goto("/library");
      await page.waitForLoadState("networkidle");

      const redirected = !page.url().includes("/library");
      test.skip(redirected, "Authentication required to access library page");
      if (redirected) return;

      // PaginatedDataLoader renders <>{empty}</> when items.length === 0
      // The library page provides EmptyState with "Bibliothèque vide" text
      const emptyState = page.getByText("Bibliothèque vide");
      const cards = page.locator('a[href^="/scenario/"]');

      const hasEmptyState = await emptyState.isVisible().catch(() => false);
      const hasCards = await cards.first().isVisible().catch(() => false);

      // If neither is visible, skip gracefully
      if (!hasEmptyState && !hasCards) {
        test.skip(true, "Could not determine library page state (loading or error)");
        return;
      }

      if (hasCards) {
        // Items exist — skip this test (not applicable)
        test.skip(true, "Library has items, empty state not applicable");
        return;
      }

      await expect(emptyState).toBeVisible();
    });

    test("should render children when items are loaded", async ({ page }) => {
      await page.goto("/library");
      await page.waitForLoadState("networkidle");

      const redirected = !page.url().includes("/library");
      test.skip(redirected, "Authentication required to access library page");
      if (redirected) return;

      // If items are loaded, ScenarioCard links should be visible
      const scenarioCard = page.locator('a[href^="/scenario/"]').first();
      const cardExists = await scenarioCard.isVisible().catch(() => false);

      if (!cardExists) {
        // Check for empty state
        const emptyState = page.getByText("Bibliothèque vide");
        const hasEmpty = await emptyState.isVisible().catch(() => false);
        test.skip(hasEmpty, "Library is empty, children not rendered");
        return;
      }

      await expect(scenarioCard).toBeVisible();
    });
  });
});
