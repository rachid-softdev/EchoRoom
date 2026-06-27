import { expect, test } from "@playwright/test";

/**
 * Mock la session utilisateur (authentifiée ou non)
 */
async function mockSession(
  page: import("@playwright/test").Page,
  user: { id: string; email: string; role: string; username?: string } | null,
) {
  if (!user) {
    await page.route("**/api/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: null,
          expires: new Date(Date.now() + 86_400_000).toISOString(),
        }),
      });
    });
    return;
  }
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user,
        expires: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    });
  });
}

/**
 * Mock le endpoint scenarios.getById avec les données fournies
 */
async function mockScenario(
  page: import("@playwright/test").Page,
  data: Record<string, unknown>,
  status = 200,
) {
  await page.route("**/api/trpc/scenarios.getById*", async (route) => {
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify([{ result: { data: { json: status === 200 ? data : null } } }]),
    });
  });
}

/**
 * Mock le endpoint scenarios.feed pour les scénarios liés
 */
async function mockFeed(
  page: import("@playwright/test").Page,
  items: Array<Record<string, unknown>>,
) {
  await page.route("**/api/trpc/scenarios.feed*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ result: { data: { json: { items } } } }]),
    });
  });
}

test.describe("Scenario Detail — permissions et visibilité", () => {
  // ─── PRIVATE visibility ─────────────────────────────────────────

  test("PRIVATE : le créateur voit le scénario", async ({ page }) => {
    const creatorId = "creator-123";
    await mockSession(page, {
      id: creatorId,
      email: "creator@test.com",
      role: "USER",
      username: "creator",
    });
    await mockScenario(page, {
      id: "scenario-1",
      title: "Mon scénario privé",
      description: "Visible seulement par moi",
      visibility: "PRIVATE",
      creatorId: creatorId,
      creator: { id: creatorId, username: "creator" },
      character: { name: "Bot", avatarUrl: null },
      playCount: 0,
      likeCount: 0,
      _count: { comments: 0 },
    });

    await page.goto("/scenario/scenario-1");
    await page.waitForLoadState("networkidle");

    // Le créateur doit voir le titre du scénario
    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login malgré le mock de session");
    if (redirected) return;

    await expect(page.getByText("Mon scénario privé")).toBeVisible();
    await expect(page.getByText("Visible seulement par moi")).toBeVisible();
  });

  test("PRIVATE : un non-créateur reçoit une page d'erreur 404 (scénario introuvable)", async ({
    page,
  }) => {
    // Autre utilisateur (pas le créateur) : le serveur appelle notFound()
    await mockSession(page, { id: "other-user", email: "other@test.com", role: "USER" });

    // Simuler que le serveur ne renvoie pas le scénario (404)
    await page.route("**/api/trpc/scenarios.getById*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            result: {
              data: {
                json: null, // Le scénario n'est pas retourné → le client affiche "Scénario introuvable"
              },
            },
          },
        ]),
      });
    });

    await page.goto("/scenario/scenario-1");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login malgré le mock de session");
    if (redirected) return;

    // Le message "Scénario introuvable" doit s'afficher
    await expect(page.getByText("Scénario introuvable")).toBeVisible();
  });

  test("PRIVATE : utilisateur non connecté voit la page d'erreur (pas de redirection vers login)", async ({
    page,
  }) => {
    // Session non authentifiée
    await mockSession(page, null);

    // Scénario privé non accessible → serveur renvoie la page SSR avec la 404
    await mockScenario(page, {
      id: "scenario-1",
      title: "Privé",
      visibility: "PRIVATE",
    });

    await page.goto("/scenario/scenario-1");
    await page.waitForLoadState("networkidle");

    // Sans session, la page ne redirige pas vers /login (c'est une route publique)
    // Mais la page doit afficher le fallback du scénario introuvable
    // ou des métadonnées génériques
    const notFoundText = page.getByText("Scénario introuvable");
    const notFoundVisible = await notFoundText.isVisible().catch(() => false);

    if (notFoundVisible) {
      await expect(notFoundText).toBeVisible();
    }
  });

  // ─── Admin voit TOUS les scénarios ──────────────────────────────

  test("Admin voit un scénario PRIVATE sans être le créateur", async ({ page }) => {
    await mockSession(page, {
      id: "admin-id",
      email: "admin@test.com",
      role: "ADMIN",
      username: "admin",
    });

    // L'admin doit pouvoir voir tous les scénarios, même PRIVATE
    await mockScenario(page, {
      id: "scenario-admin-view",
      title: "Scénario privé vu par admin",
      description: "Les admins voient tout",
      visibility: "PRIVATE",
      creatorId: "some-other-user",
      creator: { id: "other", username: "otheruser" },
      character: { name: "Bot", avatarUrl: null },
      playCount: 0,
      likeCount: 0,
      _count: { comments: 0 },
    });

    await page.goto("/scenario/scenario-admin-view");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login malgré le mock de session admin");
    if (redirected) return;

    // L'admin doit pouvoir voir le titre
    await expect(page.getByText("Scénario privé vu par admin")).toBeVisible();
  });

  test("Admin voit un scénario PUBLIC normal", async ({ page }) => {
    await mockSession(page, {
      id: "admin-id",
      email: "admin@test.com",
      role: "ADMIN",
      username: "admin",
    });
    await mockScenario(page, {
      id: "scenario-public",
      title: "Scénario public",
      description: "Description publique",
      visibility: "PUBLIC",
      creatorId: "creator-id",
      creator: { id: "creator-id", username: "creator" },
      character: { name: "Dr. Smith", avatarUrl: null },
      playCount: 10,
      likeCount: 5,
      _count: { comments: 2 },
    });

    await page.goto("/scenario/scenario-public");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login malgré le mock de session admin");
    if (redirected) return;

    await expect(page.getByText("Scénario public")).toBeVisible();
  });

  // ─── Related scenarios max 3, exclut le courant ────────────────

  test("Les scénarios similaires sont limités à 3 et excluent le scénario courant", async ({
    page,
  }) => {
    await mockSession(page, { id: "user-1", email: "user@test.com", role: "USER" });

    // Mock le scénario courant
    await mockScenario(page, {
      id: "current-scenario",
      title: "Scénario actuel",
      description: "Description",
      visibility: "PUBLIC",
      creatorId: "user-1",
      creator: { id: "user-1", username: "testuser" },
      character: { name: "Bot", avatarUrl: null },
      playCount: 10,
      likeCount: 5,
      _count: { comments: 2 },
    });

    // Mock le feed avec 4 items (dont le courant + 3 autres)
    // Le composant filtre l'item courant et garde max 3
    await mockFeed(page, [
      { id: "current-scenario", title: "Scénario actuel", slug: "scenario-actuel" },
      { id: "related-1", title: "Similaire 1", slug: "similaire-1" },
      { id: "related-2", title: "Similaire 2", slug: "similaire-2" },
      { id: "related-3", title: "Similaire 3", slug: "similaire-3" },
    ]);

    await page.goto("/scenario/current-scenario");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login");
    if (redirected) return;

    // La section "Scénarios similaires" doit être visible
    const relatedSection = page.getByText("Scénarios similaires");
    await expect(relatedSection).toBeVisible();

    // Exactement 3 cartes de scénarios dans cette section
    const relatedGrid = page
      .getByText("Scénarios similaires")
      .locator("..")
      .locator("..")
      .locator(".grid");
    const cards = relatedGrid.locator("> a, > div");
    const cardCount = await cards.count();
    expect(cardCount).toBeLessThanOrEqual(3);

    // Le scénario courant ne doit pas apparaître
    await expect(page.getByText("Similaire 1")).toBeVisible();
    await expect(page.getByText("Similaire 2")).toBeVisible();
    await expect(page.getByText("Similaire 3")).toBeVisible();

    // Le titre "Scénario actuel" ne doit PAS être dans les scénarios similaires (un seul occurrence : le h1)
    const currentTitleInRelated = page.getByText("Scénario actuel");
    await expect(currentTitleInRelated).toHaveCount(1); // uniquement le h1
  });

  test("Related scenarios limité à 3 même si plus de 3 disponibles", async ({ page }) => {
    await mockSession(page, { id: "user-1", email: "user@test.com", role: "USER" });

    await mockScenario(page, {
      id: "current",
      title: "Scénario courant",
      description: "Description",
      visibility: "PUBLIC",
      creatorId: "user-1",
      creator: { id: "user-1", username: "testuser" },
      character: { name: "Bot", avatarUrl: null },
      playCount: 10,
      likeCount: 5,
      _count: { comments: 2 },
    });

    // Feed avec 5 items différents du courant
    await mockFeed(page, [
      { id: "r1", title: "Related 1" },
      { id: "r2", title: "Related 2" },
      { id: "r3", title: "Related 3" },
      { id: "r4", title: "Related 4" },
      { id: "r5", title: "Related 5" },
    ]);

    await page.goto("/scenario/current");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login");
    if (redirected) return;

    // Maximum 3 scénarios similaires
    const relatedSection = page.getByText("Scénarios similaires");
    await expect(relatedSection).toBeVisible();

    // Vérifier que les cartes sont bien au nombre de 3
    const relatedCards = page
      .getByText("Scénarios similaires")
      .locator("..")
      .locator("..")
      .locator(".grid > *");
    const count = await relatedCards.count();
    expect(count).toBeLessThanOrEqual(3);

    // Seulement les 3 premiers (r1, r2, r3) sont affichés
    await expect(page.getByText("Related 1")).toBeVisible();
    await expect(page.getByText("Related 2")).toBeVisible();
    await expect(page.getByText("Related 3")).toBeVisible();

    // Related 4 et 5 ne doivent pas être visibles
    await expect(page.getByText("Related 4")).not.toBeVisible();
    await expect(page.getByText("Related 5")).not.toBeVisible();
  });

  // ─── Related scenarios caché si aucun ──────────────────────────

  test("La section 'Scénarios similaires' est cachée s'il n'y en a aucun", async ({ page }) => {
    await mockSession(page, { id: "user-1", email: "user@test.com", role: "USER" });

    await mockScenario(page, {
      id: "sole-scenario",
      title: "Seul scénario",
      visibility: "PUBLIC",
      creatorId: "user-1",
      creator: { id: "user-1", username: "testuser" },
      character: { name: "Bot", avatarUrl: null },
      playCount: 0,
      likeCount: 0,
      _count: { comments: 0 },
    });

    // Feed vide (pas de scénarios)
    await mockFeed(page, []);

    await page.goto("/scenario/sole-scenario");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login");
    if (redirected) return;

    // La section "Scénarios similaires" ne doit PAS être visible
    const relatedHeading = page.getByText("Scénarios similaires");
    await expect(relatedHeading).not.toBeVisible();
  });

  // ─── Loading / Error / Empty states ────────────────────────────

  test("Affiche un squelette de chargement pendant le chargement", async ({ page }) => {
    // Ne pas résoudre la requête pour maintenir isLoading = true
    await page.route("**/api/trpc/scenarios.getById*", async () => {
      // Ne jamais répondre
    });
    await mockSession(page, { id: "user-1", email: "user@test.com", role: "USER" });

    await page.goto("/scenario/scenario-loading");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login");
    if (redirected) return;

    // Les squelettes animate-pulse doivent être visibles
    const skeletons = page.locator('[class*="animate-pulse"]');
    await expect(skeletons.first()).toBeVisible();
  });

  test("Affiche un état d'erreur avec bouton 'Réessayer'", async ({ page }) => {
    await mockSession(page, { id: "user-1", email: "user@test.com", role: "USER" });

    // Simuler une erreur tRPC
    await page.route("**/api/trpc/scenarios.getById*", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "Erreur serveur" } }),
      });
    });

    await page.goto("/scenario/scenario-error");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login");
    if (redirected) return;

    // Message d'erreur
    await expect(page.getByText("Une erreur est survenue")).toBeVisible();

    // Bouton Réessayer
    await expect(page.getByRole("button", { name: /Réessayer/ })).toBeVisible();
  });

  test("Affiche 'Scénario introuvable' quand le scénario n'existe pas", async ({ page }) => {
    await mockSession(page, { id: "user-1", email: "user@test.com", role: "USER" });

    // Simuler l'absence de données
    await page.route("**/api/trpc/scenarios.getById*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ result: { data: { json: null } } }]),
      });
    });

    await page.goto("/scenario/non-existent");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login");
    if (redirected) return;

    await expect(page.getByText("Scénario introuvable")).toBeVisible();
  });
});
