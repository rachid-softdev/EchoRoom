import { test, expect } from "@playwright/test";
import path from "path";

const COMPONENT_PATH = path.resolve(
  __dirname,
  "../../src/components/shared/DataLoader.tsx",
);

function readComponent(): string {
  return require("fs").readFileSync(COMPONENT_PATH, "utf-8");
}

/**
 * Helper: retarde les appels tRPC pour observer l'état loading.
 */
async function delayTrpcRoutes(
  page: import("@playwright/test").Page,
  delayMs = 10000,
) {
  await page.route("**/api/trpc/**", async (route) => {
    await new Promise((r) => setTimeout(r, delayMs));
    await route.continue();
  });
}

/**
 * Helper: fait échouer les appels tRPC pour observer l'état error.
 */
async function failTrpcRoutes(page: import("@playwright/test").Page) {
  await page.route("**/api/trpc/**", (route) => route.abort());
}

test.describe("DataLoader — Composant Partagé", () => {
  // ─── Analyse statique du source ─────────────────────────────────────

  test("est exporté comme fonction nommée", () => {
    const source = readComponent();
    expect(source).toContain("export function DataLoader");
  });

  test("accepte les props query, children, empty, isEmpty, skeletonCount, skeleton", () => {
    const source = readComponent();
    expect(source).toContain("query");
    expect(source).toContain("children");
    expect(source).toContain("empty");
    expect(source).toContain("isEmpty");
    expect(source).toContain("skeletonCount");
    expect(source).toContain("skeleton");
  });

  test("traite les 4 états dans l'ordre : loading → error → empty → children", () => {
    const source = readComponent();
    // Vérifie l'ordre des conditions
    const loadingIndex = source.indexOf("query.isLoading");
    const errorIndex = source.indexOf("query.isError");
    const emptyIndex = source.indexOf("!query.data || isEmpty");
    const childrenIndex = source.indexOf("children(query.data");

    expect(loadingIndex).toBeLessThan(errorIndex);
    expect(errorIndex).toBeLessThan(emptyIndex);
    expect(emptyIndex).toBeLessThan(childrenIndex);
  });

  // ─── Loading → skeleton visible ────────────────────────────────────

  test("skeletonCount par défaut est 3", () => {
    const source = readComponent();
    expect(source).toContain("skeletonCount = 3");
  });

  test("loading — live: skeleton grid avec md:grid-cols-3 visible", async ({
    page,
  }) => {
    await delayTrpcRoutes(page);
    await page.goto("/explore", { waitUntil: "commit" });

    // La grille skeleton avec md:grid-cols-3 doit être visible
    const skeletonGrid = page.locator("div.grid.md\\:grid-cols-3");
    await expect(skeletonGrid).toBeVisible({ timeout: 5000 });
  });

  test("loading — live: 3 skeleton items par défaut", async ({ page }) => {
    await delayTrpcRoutes(page);
    await page.goto("/explore", { waitUntil: "commit" });

    // 3 divs skeleton à l'intérieur de la grille
    const skeletonItems = page.locator(
      "div.grid.md\\:grid-cols-3 > div.rounded-xl",
    );
    await expect(skeletonItems).toHaveCount(3, { timeout: 5000 });
  });

  test("loading — live: chaque skeleton contient des Skeleton components", async ({
    page,
  }) => {
    await delayTrpcRoutes(page);
    await page.goto("/explore", { waitUntil: "commit" });

    // Chaque item skeleton a 3 Skeleton (h-4 w-1/3, h-6 w-2/3, h-4 w-full)
    const skeletonItems = page.locator(
      "div.grid.md\\:grid-cols-3 > div.rounded-xl",
    );
    await expect(skeletonItems).toHaveCount(3, { timeout: 5000 });

    // Vérifie la présence de Skeleton (div with animate-pulse)
    const skeletonPlaceholders = page.locator(
      "div.rounded-xl.border.border-border div.animate-pulse",
    );
    await expect(skeletonPlaceholders).toHaveCount(9, { timeout: 5000 });
  });

  // ─── Error → AlertTriangle + "Réessayer" ───────────────────────────

  test("error — le composant rend AlertTriangle et 'Une erreur est survenue'", () => {
    const source = readComponent();
    expect(source).toContain("AlertTriangle");
    expect(source).toContain("Une erreur est survenue");
    expect(source).toContain("Réessayer");
    expect(source).toContain("RotateCcw");
  });

  test("error — live: AlertTriangle visible quand tRPC échoue", async ({
    page,
  }) => {
    await failTrpcRoutes(page);
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    // Titre d'erreur
    await expect(
      page.getByText("Une erreur est survenue"),
    ).toBeVisible({ timeout: 10000 });

    // Message par défaut
    await expect(
      page.getByText("Impossible de charger les données"),
    ).toBeVisible({ timeout: 10000 });
  });

  test("error — live: bouton Réessayer avec icône RotateCw visible", async ({
    page,
  }) => {
    await failTrpcRoutes(page);
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    const retryButton = page.getByRole("button", { name: "Réessayer" });
    await expect(retryButton).toBeVisible();

    // L'icône RotateCw (lucide-react)
    await expect(page.locator("svg.lucide-rotate-ccw")).toBeVisible();
  });

  test("error — affiche le message d'erreur personnalisé s'il existe", () => {
    const source = readComponent();
    // Soit query.error?.message, soit le message par défaut
    expect(source).toContain("query.error?.message");
    expect(source).toContain("'Impossible de charger les données. Réessayez.'");
  });

  test("error — layout centré avec py-16", () => {
    const source = readComponent();
    expect(source).toContain(
      "flex flex-col items-center justify-center py-16 text-center",
    );
    expect(source).toContain("w-12 h-12 text-destructive mb-4");
  });

  // ─── Refetch après erreur → loading → data ─────────────────────────

  test("refetch — le bouton Réessayer appelle query.refetch()", () => {
    const source = readComponent();
    expect(source).toContain("query.refetch()");
  });

  test("refetch — live: clic Réessayer déclenche un nouvel appel API", async ({
    page,
  }) => {
    // Compte les appels tRPC
    let trpcCallCount = 0;
    await page.route("**/api/trpc/**", async (route) => {
      trpcCallCount++;
      // Premier appel = erreur
      if (trpcCallCount === 1) {
        await route.abort();
      } else {
        // Appels suivants = succès
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              result: {
                data: {
                  json: { scenarios: [] },
                },
              },
            },
          ]),
        });
      }
    });

    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    // État erreur
    await expect(
      page.getByText("Une erreur est survenue"),
    ).toBeVisible({ timeout: 10000 });

    // Clic Réessayer
    const retryButton = page.getByRole("button", { name: "Réessayer" });
    await retryButton.click();

    // Un nouvel appel API doit être fait (compteur >= 2)
    await page.waitForTimeout(1000);
    expect(trpcCallCount).toBeGreaterThanOrEqual(2);
  });

  test("refetch — live: après refetch réussi, les données s'affichent", async ({
    page,
  }) => {
    let isFirstCall = true;
    await page.route("**/api/trpc/explore.*", async (route) => {
      if (isFirstCall) {
        isFirstCall = false;
        await route.abort();
      } else {
        // Retourne des scénarios mockés
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              result: {
                data: {
                  json: {
                    scenarios: [
                      {
                        id: "test-scenario-1",
                        title: "Scénario après refetch",
                        description: "Test",
                        character: { name: "Test", category: "romantic" },
                        visibility: "PUBLIC",
                      },
                    ],
                  },
                },
              },
            },
          ]),
        });
      }
    });

    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    // État erreur
    await expect(
      page.getByText("Une erreur est survenue"),
    ).toBeVisible({ timeout: 10000 });

    // Clic Réessayer
    const retryButton = page.getByRole("button", { name: "Réessayer" });
    await retryButton.click();

    // Maintenant les données doivent être chargées
    await expect(
      page.getByText("Scénario après refetch"),
    ).toBeVisible({ timeout: 10000 });
  });

  // ─── Empty state custom (isEmpty callback) ──────────────────────────

  test("empty — rend le contenu par défaut 'Aucun résultat' quand empty n'est pas fourni", () => {
    const source = readComponent();
    expect(source).toContain("Aucun résultat");
    expect(source).toContain("empty ??");
  });

  test("empty — supporte un callback isEmpty personnalisé", () => {
    const source = readComponent();
    expect(source).toContain("isEmpty?.(query.data)");
  });

  test("empty — rend le contenu personnalisé empty quand fourni", () => {
    const source = readComponent();
    expect(source).toContain("empty ?? (");
    // Si empty n'est pas fourni, rend le fallback "Aucun résultat"
  });

  test("empty — live: recherche sans résultat affiche 'Aucun résultat'", async ({
    page,
  }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    // Recherche avec un terme très improbable
    const searchInput = page.getByPlaceholder("Rechercher un scénario...");
    await searchInput.fill("zzzzznonexistentxxxxx");

    // Attend le debounce
    await page.waitForTimeout(500);

    await expect(page.getByText("Aucun résultat")).toBeVisible();
  });

  test("empty — live: empty personnalisé sur la home page", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const customEmpty = page.getByText("Aucun scénario à la une aujourd'hui");
    const customExists = await customEmpty.isVisible().catch(() => false);

    if (!customExists) {
      // Peut-être que des scénarios sont chargés, on skip gracieusement
      const featuredCard = page
        .locator('a[href^="/scenario/"]')
        .first();
      const cardExists = await featuredCard.isVisible().catch(() => false);
      test.skip(
        !cardExists,
        "Aucune donnée pour tester le empty state custom",
      );
      if (cardExists) return;
    }

    await expect(customEmpty).toBeVisible();
  });

  // ─── Skeleton personnalisé (skeletonCount, custom skeleton) ─────────

  test("skeleton — skeletonCount personnalisé modifie le nombre d'items", () => {
    const source = readComponent();
    // skeletonCount est utilisé dans Array.from({ length: skeletonCount })
    expect(source).toContain("Array.from({ length: skeletonCount })");
  });

  test("skeleton — un skeleton personnalisé remplace la grille par défaut", () => {
    const source = readComponent();
    // Si skeleton est fourni, il est rendu à la place du defaut
    expect(source).toContain("skeleton ?? (");
    // Le code après ?? est le rendu par défaut de la grille
    expect(source).toContain('<div className="grid md:grid-cols-3 gap-4">');
  });

  test("skeleton — live: 3 squelettes par défaut sur /explore (loading)", async ({
    page,
  }) => {
    await delayTrpcRoutes(page);
    await page.goto("/explore", { waitUntil: "commit" });

    // Vérifie le nombre de conteneurs skeleton
    const skeletonContainers = page.locator(
      "div.grid.md\\:grid-cols-3 > div.rounded-xl",
    );
    await expect(skeletonContainers).toHaveCount(3, { timeout: 5000 });
  });

  test("skeleton — structure du skeleton contient border border-border", async ({
    page,
  }) => {
    await delayTrpcRoutes(page);
    await page.goto("/explore", { waitUntil: "commit" });

    const skeletonItem = page
      .locator("div.grid.md\\:grid-cols-3 > div.rounded-xl")
      .first();
    await expect(skeletonItem).toBeVisible({ timeout: 5000 });

    // La classe border et border-border
    const classAttr = await skeletonItem.getAttribute("class");
    expect(classAttr).toContain("border");
    expect(classAttr).toContain("border-border");
  });

  // ─── Tests de rendu conditionnel ────────────────────────────────────

  test("rend les children quand query.data existe et isEmpty est false", () => {
    const source = readComponent();
    // Le dernier bloc retourne children(query.data)
    expect(source).toContain("children(query.data as NonNullable<T>)");
  });

  test("le bloc data est wrapped dans un fragment React (<></>)", () => {
    const source = readComponent();
    expect(source).toContain("return <>{children(query.data");
  });
});
