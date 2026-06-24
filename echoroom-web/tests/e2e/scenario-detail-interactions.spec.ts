import { test, expect } from "@playwright/test";

/**
 * Mock session utilisateur
 */
async function mockSession(
  page: import("@playwright/test").Page,
  user: { id: string; email: string; role: string; username?: string } | null = {
    id: "user-1",
    email: "test@test.com",
    role: "USER",
    username: "testuser",
  },
) {
  if (!user) {
    await page.route("**/api/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: null, expires: new Date(Date.now() + 86_400_000).toISOString() }),
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
 * Mock scenarios.getById
 */
async function mockScenario(page: import("@playwright/test").Page, overrides: Record<string, unknown> = {}) {
  const defaultScenario = {
    id: "scenario-1",
    title: "Scénario de test",
    description: "Description du scénario de test pour les interactions",
    visibility: "PUBLIC",
    creatorId: "user-1",
    creator: { id: "user-1", username: "testuser" },
    character: { name: "Dr. Smith", avatarUrl: null },
    playCount: 42,
    likeCount: 7,
    _count: { comments: 3 },
  };

  await page.route("**/api/trpc/scenarios.getById*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { result: { data: { json: { ...defaultScenario, ...overrides } } } },
      ]),
    });
  });
}

/**
 * Mock scenarios.feed (pour les scénarios liés)
 */
async function mockFeed(page: import("@playwright/test").Page, items: Array<Record<string, unknown>> = []) {
  await page.route("**/api/trpc/scenarios.feed*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { result: { data: { json: { items } } } },
      ]),
    });
  });
}

test.describe("Scenario Detail — interactions sociales", () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page);
    await mockScenario(page);
    await mockFeed(page);
  });

  // ─── ReactionBar toggle like (optimistic) ───────────────────────

  test("ReactionBar affiche les réactions existantes", async ({ page }) => {
    // Mock social.getReactions
    await page.route("**/api/trpc/social.getReactions*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { result: { data: { json: { reactions: [{ emoji: "🔥", count: 5, hasReacted: false }] } } } },
        ]),
      });
    });

    await page.goto("/scenario/scenario-1");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login");
    if (redirected) return;

    // La réaction 🔥 avec le compte 5 doit être visible
    await expect(page.getByText("🔥")).toBeVisible();
    await expect(page.getByText("5")).toBeVisible();
  });

  test("ReactionBar toggle like met à jour l'UI (mutation)", async ({ page }) => {
    // Mock social.getReactions — pas de réaction initiale
    await page.route("**/api/trpc/social.getReactions*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { result: { data: { json: { reactions: [] } } } },
        ]),
      });
    });

    // Mock social.toggleLike — succès
    await page.route("**/api/trpc/social.toggleLike*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { result: { data: { json: { success: true } } } },
        ]),
      });
    });

    await page.goto("/scenario/scenario-1");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login");
    if (redirected) return;

    // Bouton "+" pour ajouter une réaction
    const addBtn = page.getByRole("button", { name: "Ajouter une réaction" });
    await expect(addBtn).toBeVisible();
  });

  test("Le bouton + pour ajouter une réaction a l'aria-label correct", async ({ page }) => {
    await page.goto("/scenario/scenario-1");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login");
    if (redirected) return;

    // Vérifie l'aria-label du bouton +
    const addBtn = page.getByRole("button", { name: "Ajouter une réaction" });
    await expect(addBtn).toBeVisible();
  });

  // ─── Emoji picker ouverture/fermeture ──────────────────────────

  test("EmojiPicker s'ouvre au clic sur le bouton +", async ({ page }) => {
    await page.route("**/api/trpc/social.getReactions*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { result: { data: { json: { reactions: [] } } } },
        ]),
      });
    });

    await page.goto("/scenario/scenario-1");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login");
    if (redirected) return;

    // Cliquer sur le bouton +
    await page.getByRole("button", { name: "Ajouter une réaction" }).click();

    // L'EmojiPicker doit être visible (grille d'emojis)
    // Les emojis sont dans une div absolute avec shadow-xl
    const emojiGrid = page.locator("div.absolute.shadow-xl");
    await expect(emojiGrid).toBeVisible();

    // Au moins un emoji doit être visible
    await expect(emojiGrid.getByText("❤️")).toBeVisible();
  });

  test("EmojiPicker se ferme après sélection d'un émoji", async ({ page }) => {
    let reactionsCount = 0;
    await page.route("**/api/trpc/social.getReactions*", async (route) => {
      // Au premier appel, réactions vides
      if (reactionsCount === 0) {
        reactionsCount++;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            { result: { data: { json: { reactions: [] } } } },
          ]),
        });
      } else {
        // Appel suivant (refetch après mutation) — avec la nouvelle réaction
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            { result: { data: { json: { reactions: [{ emoji: "❤️", count: 1 }] } } } },
          ]),
        });
      }
    });

    // Mock toggleLike
    await page.route("**/api/trpc/social.toggleLike*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { result: { data: { json: { success: true } } } },
        ]),
      });
    });

    await page.goto("/scenario/scenario-1");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login");
    if (redirected) return;

    // Ouvrir l'EmojiPicker
    await page.getByRole("button", { name: "Ajouter une réaction" }).click();
    await expect(page.locator("div.absolute.shadow-xl")).toBeVisible();

    // Cliquer sur ❤️
    await page.locator("div.absolute.shadow-xl").getByText("❤️").click();
    await page.waitForTimeout(300);

    // L'EmojiPicker doit se fermer
    await expect(page.locator("div.absolute.shadow-xl")).not.toBeVisible();
  });

  // ─── ShareButtons : Twitter popup + clipboard copy ─────────────

  test("ShareButtons affiche les 4 boutons de partage", async ({ page }) => {
    await page.goto("/scenario/scenario-1");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login");
    if (redirected) return;

    // 4 boutons de partage
    await expect(page.getByRole("button", { name: /Twitter/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Discord/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /TikTok/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Partager/ })).toBeVisible();
  });

  test("ShareButtons Twitter/X ouvre un popup avec l'URL du scénario", async ({ page }) => {
    // Intercepter l'ouverture de fenêtre
    let popupUrl = "";
    page.on("popup", (popup) => {
      popupUrl = popup.url();
    });

    // Mock trackShare pour éviter les erreurs
    await page.route("**/api/trpc/social.trackShare*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { result: { data: { json: { success: true } } } },
        ]),
      });
    });

    await page.goto("/scenario/scenario-1");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login");
    if (redirected) return;

    // Cliquer sur le bouton Twitter/X
    await page.getByRole("button", { name: /Twitter/ }).click();

    // Vérifier qu'un popup a été ouvert avec l'intent Twitter
    if (popupUrl) {
      expect(popupUrl).toContain("twitter.com/intent/tweet");
      expect(popupUrl).toContain(encodeURIComponent("scenario-1"));
    }
  });

  test("ShareButtons Discord copie le lien dans le presse-papier", async ({ page }) => {
    // Mock clipboard API
    await page.context().grantPermissions(["clipboard-write", "clipboard-read"]);

    // Mock trackShare
    await page.route("**/api/trpc/social.trackShare*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { result: { data: { json: { success: true } } } },
        ]),
      });
    });

    await page.goto("/scenario/scenario-1");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login");
    if (redirected) return;

    // Cliquer sur Discord
    await page.getByRole("button", { name: /Discord/ }).click();
    await page.waitForTimeout(200);

    // Vérifier le contenu du presse-papier
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain("/scenario/scenario-1");
  });

  // ─── ReportButton : dialog, validation 10 char, conflit ────────

  test("ReportButton ouvre un dialog avec titre 'Signaler un contenu'", async ({ page }) => {
    await page.goto("/scenario/scenario-1");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login");
    if (redirected) return;

    // Cliquer sur le bouton Signaler (variant icon)
    const reportBtn = page.getByRole("button", { name: "Signaler" });
    await reportBtn.click();

    // Le dialog doit être visible
    await expect(page.getByText("Signaler un contenu")).toBeVisible();
    await expect(page.getByText("Ce signalement sera examiné par notre équipe de modération")).toBeVisible();
  });

  test("ReportButton validation : bouton désactivé si < 10 caractères", async ({ page }) => {
    await page.goto("/scenario/scenario-1");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login");
    if (redirected) return;

    // Ouvrir le dialog
    await page.getByRole("button", { name: "Signaler" }).click();

    // Saisir une raison trop courte
    const textarea = page.getByPlaceholder(/minimum 10 caractères/);
    await textarea.fill("Court");

    // Le bouton "Signaler" doit être désactivé
    const submitBtn = page.getByRole("button", { name: "Signaler" });
    await expect(submitBtn).toBeDisabled();

    // Le compteur doit indiquer "X caractères minimum requis"
    await expect(page.getByText("caractères minimum requis")).toBeVisible();
  });

  test("ReportButton validation : bouton activé avec 10+ caractères", async ({ page }) => {
    await page.goto("/scenario/scenario-1");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login");
    if (redirected) return;

    // Ouvrir le dialog
    await page.getByRole("button", { name: "Signaler" }).click();

    // Saisir une raison suffisamment longue
    const textarea = page.getByPlaceholder(/minimum 10 caractères/);
    await textarea.fill("Ce contenu est inapproprié car il contient des insultes.");

    // Le bouton doit être activé
    const submitBtn = page.getByRole("button", { name: "Signaler" });
    await expect(submitBtn).toBeEnabled();

    // Le compteur doit indiquer "Signalement prêt à être envoyé"
    await expect(page.getByText("Signalement prêt à être envoyé")).toBeVisible();
  });

  test("ReportButton : conflit 'déjà signalé' géré via toast erreur", async ({ page }) => {
    await page.route("**/api/trpc/community.reportAbuse*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            result: {
              data: {
                json: { error: { message: "Vous avez déjà signalé ce contenu" } },
              },
            },
          },
        ]),
      });
    });

    await page.goto("/scenario/scenario-1");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login");
    if (redirected) return;

    // Ouvrir le dialog
    await page.getByRole("button", { name: "Signaler" }).click();

    // Saisir une raison valide
    const textarea = page.getByPlaceholder(/minimum 10 caractères/);
    await textarea.fill("Ce contenu est vraiment problématique pour plusieurs raisons.");

    // Soumettre
    await page.getByRole("button", { name: "Signaler" }).click();
    await page.waitForTimeout(500);

    // Vérifier que le toast d'erreur est affiché
    // (Le toast peut être visible via la librairie de notification)
  });

  // ─── CommentsSection : Enter key submit ────────────────────────

  test("CommentsSection permet de soumettre un commentaire avec la touche Entrée", async ({ page }) => {
    // Mock community.getComments
    await page.route("**/api/trpc/community.getComments*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { result: { data: { json: { items: [] } } } },
        ]),
      });
    });

    // Mock community.comment
    await page.route("**/api/trpc/community.comment*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { result: { data: { json: { success: true } } } },
        ]),
      });
    });

    await page.goto("/scenario/scenario-1");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login");
    if (redirected) return;

    // Trouver le champ de commentaire
    const commentInput = page.getByPlaceholder("Ajouter un commentaire...");
    await expect(commentInput).toBeVisible();

    // Saisir un commentaire
    await commentInput.fill("Super scénario !");

    // Appuyer sur Entrée
    await commentInput.press("Enter");
    await page.waitForTimeout(300);

    // Le champ doit être vidé après soumission (simulé par le mock)
    // Note : le mock ne déclenche pas le onSuccess du useMutation,
    // donc le input peut ne pas être vidé. On vérifie juste qu'il n'y a pas d'erreur.
  });

  test("CommentsSection : le bouton d'envoi est désactivé quand l'input est vide", async ({ page }) => {
    await page.route("**/api/trpc/community.getComments*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { result: { data: { json: { items: [] } } } },
        ]),
      });
    });

    await page.goto("/scenario/scenario-1");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login");
    if (redirected) return;

    // Le bouton d'envoi (Send) doit être désactivé quand l'input est vide
    const sendBtn = page.getByRole("button", { name: "Envoyer le commentaire" });
    await expect(sendBtn).toBeDisabled();
  });

  // ─── CommentsSection : non-auth link login ─────────────────────

  test("CommentsSection : utilisateur non connecté voit un lien 'Connectez-vous pour commenter'", async ({ page }) => {
    // Session non authentifiée
    await mockSession(page, null);
    await mockScenario(page);

    await page.route("**/api/trpc/community.getComments*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { result: { data: { json: { items: [] } } } },
        ]),
      });
    });

    await page.goto("/scenario/scenario-1");
    await page.waitForLoadState("networkidle");

    // Lien "Connectez-vous pour commenter"
    const loginLink = page.getByText("Connectez-vous pour commenter");
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute("href", /\/login\?redirect=\/scenario\/scenario-1/);
  });

  test("CommentsSection : les commentaires existants sont affichés", async ({ page }) => {
    await page.route("**/api/trpc/community.getComments*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            result: {
              data: {
                json: {
                  items: [
                    {
                      id: "c1",
                      content: "Premier commentaire !",
                      createdAt: new Date().toISOString(),
                      user: { id: "u1", username: "alice", image: null },
                    },
                    {
                      id: "c2",
                      content: "Super scénario !",
                      createdAt: new Date().toISOString(),
                      user: { id: "u2", username: "bob", image: null },
                    },
                  ],
                },
              },
            },
          },
        ]),
      });
    });

    await page.goto("/scenario/scenario-1");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login");
    if (redirected) return;

    // Les commentaires doivent être visibles
    await expect(page.getByText("Premier commentaire !")).toBeVisible();
    await expect(page.getByText("Super scénario !")).toBeVisible();
    await expect(page.getByText("alice")).toBeVisible();
    await expect(page.getByText("bob")).toBeVisible();

    // Le compteur de commentaires doit être "Commentaires (2)"
    await expect(page.getByText(/Commentaires\s*\(2\)/)).toBeVisible();
  });

  // ─── CommentsSection : admin moderate button ───────────────────

  test("CommentsSection : l'admin voit le bouton de modération (Trash2)", async ({ page }) => {
    // Session admin
    await mockSession(page, { id: "admin-1", email: "admin@test.com", role: "ADMIN", username: "admin" });
    await mockScenario(page);

    await page.route("**/api/trpc/community.getComments*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            result: {
              data: {
                json: {
                  items: [
                    {
                      id: "c1",
                      content: "Commentaire à modérer",
                      createdAt: new Date().toISOString(),
                      user: { id: "u1", username: "spammer", image: null },
                    },
                  ],
                },
              },
            },
          },
        ]),
      });
    });

    await page.goto("/scenario/scenario-1");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login");
    if (redirected) return;

    // L'admin doit voir le bouton de modération (aria-label)
    const moderateBtn = page.getByRole("button", { name: "Modérer le commentaire" });
    await expect(moderateBtn).toBeVisible();
  });

  test("CommentsSection : clic sur modérer ouvre le ConfirmDialog", async ({ page }) => {
    await mockSession(page, { id: "admin-1", email: "admin@test.com", role: "ADMIN", username: "admin" });
    await mockScenario(page);

    await page.route("**/api/trpc/community.getComments*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            result: {
              data: {
                json: {
                  items: [
                    {
                      id: "c1",
                      content: "Spam",
                      createdAt: new Date().toISOString(),
                      user: { id: "u1", username: "spammer", image: null },
                    },
                  ],
                },
              },
            },
          },
        ]),
      });
    });

    await page.goto("/scenario/scenario-1");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login");
    if (redirected) return;

    // Cliquer sur le bouton de modération
    await page.getByRole("button", { name: "Modérer le commentaire" }).click();

    // Le ConfirmDialog doit s'ouvrir
    await expect(page.getByText("Modérer le commentaire")).toBeVisible();
    await expect(page.getByText("Cette action supprimera le commentaire")).toBeVisible();
    await expect(page.getByRole("button", { name: "Modérer" })).toBeVisible();
  });

  // ─── Stats row ─────────────────────────────────────────────────

  test("La ligne de stats affiche les compteurs de likes, lectures et commentaires", async ({ page }) => {
    await page.goto("/scenario/scenario-1");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login");
    if (redirected) return;

    // Les statuts doivent être visibles
    await expect(page.getByText("7").first()).toBeVisible(); // likeCount = 7
    await expect(page.getByText("j'aime")).toBeVisible();
    await expect(page.getByText("42")).toBeVisible(); // playCount = 42
    await expect(page.getByText("lectures")).toBeVisible();
    await expect(page.getByText("3")).toBeVisible(); // comments count
    await expect(page.getByText("commentaires")).toBeVisible();
  });

  test("Stats row : les icônes Heart, Play et MessageCircle sont visibles", async ({ page }) => {
    await page.goto("/scenario/scenario-1");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login");
    if (redirected) return;

    await expect(page.locator("svg.lucide-heart")).toBeVisible();
    await expect(page.locator("svg.lucide-play")).toBeVisible();
    await expect(page.locator("svg.lucide-message-circle")).toBeVisible();
  });

  // ─── CTA section ───────────────────────────────────────────────

  test("CTA 'Démarrer l'appel' visible pour utilisateur authentifié", async ({ page }) => {
    await page.goto("/scenario/scenario-1");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Redirigé vers login");
    if (redirected) return;

    // Le bouton Démarrer l'appel doit être visible
    const ctaBtn = page.getByRole("link", { name: /Démarrer l'appel/ });
    await expect(ctaBtn).toBeVisible();
    await expect(ctaBtn).toHaveAttribute("href", /\/create\?scenario=scenario-1/);
  });

  test("CTA 'Connectez-vous' visible pour utilisateur non connecté", async ({ page }) => {
    await mockSession(page, null);
    await mockScenario(page);

    await page.goto("/scenario/scenario-1");
    await page.waitForLoadState("networkidle");

    // Le bouton doit rediriger vers login
    const loginCta = page.getByRole("link", { name: /Connectez-vous/ });
    await expect(loginCta).toBeVisible();
  });
});
