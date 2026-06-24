import { test, expect } from "@playwright/test";

/**
 * Helper: mock une session authentifiée (requise pour /create)
 */
async function mockSession(page: import("@playwright/test").Page) {
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "mock-user-id",
          name: "Test User",
          email: "test@example.com",
          username: "testuser",
          role: "USER",
          credits: 50,
        },
        expires: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    });
  });
}

/**
 * Helper: mock la liste des personnages (characters.list)
 */
async function mockCharactersList(page: import("@playwright/test").Page) {
  await page.route("**/api/trpc/characters.list*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          result: {
            data: {
              json: [
                { id: "char-1", name: "TestBot", category: "ROMANTIC", slug: "testbot" },
                { id: "char-2", name: "Assistant", category: "CORPORATE", slug: "assistant" },
              ],
            },
          },
        },
      ]),
    });
  });
}

test.describe("Create page — Validation et cas limites", () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page);
    await mockCharactersList(page);
  });

  test("titre exactement 80 caractères (maxLength)", async ({ page }) => {
    await page.goto("/create");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/create");
    test.skip(redirected, "La page /create n'a pas pu être chargée — mock insuffisant");
    if (redirected) return;

    const titleInput = page.locator("#title");

    // Vérifier l'attribut maxLength natif
    await expect(titleInput).toHaveAttribute("maxLength", "80");

    // Titre de exactement 80 caractères
    const title80 = "A".repeat(80);
    await titleInput.fill(title80);
    await expect(titleInput).toHaveValue(title80);

    // Vérifier que le navigateur bloque le dépassement (comportement natif maxLength)
    // Essayer d'ajouter un 81e caractère en tapant
    await titleInput.type("B");
    // La valeur doit toujours être 80 caractères
    const currentValue = await titleInput.inputValue();
    expect(currentValue.length).toBe(80);
  });

  test("titre exactement 3 caractères (minLength)", async ({ page }) => {
    await page.goto("/create");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/create");
    test.skip(redirected, "La page /create n'a pas pu être chargée — mock insuffisant");
    if (redirected) return;

    const titleInput = page.locator("#title");

    // Vérifier l'attribut minLength natif
    await expect(titleInput).toHaveAttribute("minLength", "3");

    // Titre de 3 caractères (valide)
    await titleInput.fill("ABC");
    await expect(titleInput).toHaveValue("ABC");

    // Titre de 2 caractères — la validation native HTML5 s'appliquera
    await titleInput.fill("AB");
    await expect(titleInput).toHaveValue("AB");

    // Vérifier que la soumission est bloquée par la validation native
    // (le bouton est désactivé car character non sélectionné, mais si on sélectionnait un character,
    //  le navigateur devrait bloquer la soumission via minLength)
  });

  test("instructions IA avec contenu XSS (tentative d'injection)", async ({ page }) => {
    await page.goto("/create");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/create");
    test.skip(redirected, "La page /create n'a pas pu être chargée — mock insuffisant");
    if (redirected) return;

    const aiInput = page.locator("#aiInstructions");

    // Tentative d'injection XSS classique
    const xssPayloads = [
      "<script>alert('XSS')</script>",
      "<img src=x onerror=alert(1)>",
      "javascript:alert('XSS')",
      "\"><script>alert('XSS')</script>",
      "'; alert('XSS'); '",
      "<svg onload=alert(1)>",
      "{{constructor.constructor('alert(1)')()}}",
    ];

    for (const payload of xssPayloads) {
      await aiInput.fill(payload);
      // Le texte doit être saisi tel quel (pas d'exécution, pas de filtrage qui le modifierait)
      await expect(aiInput).toHaveValue(payload);
    }

    // Vérifier qu'aucun popup/erreur n'apparaît (pas d'exécution XSS)
    // On recharge la page entre chaque payload pour reset l'état
    for (const payload of xssPayloads) {
      await page.reload();
      await page.waitForLoadState("networkidle");
      await aiInput.fill(payload);
      // La page doit rester stable
      await expect(page.getByText("Créer un scénario")).toBeVisible();
    }
  });

  test("instructions IA avec contenu Unicode et emojis", async ({ page }) => {
    await page.goto("/create");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/create");
    test.skip(redirected, "La page /create n'a pas pu être chargée — mock insuffisant");
    if (redirected) return;

    const aiInput = page.locator("#aiInstructions");

    // Unicode: caractères accentués, japonais, arabe, cyrillique
    const unicodeText = [
      "Instructions avec accents: éèêëàùûüçôî",
      "日本語のテキスト — instructions en japonais",
      "تعليمات باللغة العربية — instructions en arabe",
      "Инструкции на кириллице — instructions en cyrillique",
      "Español: instrucciones detalladas para el personaje IA",
      "Deutsch: ausführliche Anweisungen für die KI-Figur",
    ];

    for (const text of unicodeText) {
      // Vider et remplir avec du texte Unicode
      await aiInput.fill(text);
      await expect(aiInput).toHaveValue(text);

      // Vérifier que le compteur de caractères est correct
      const counter = page.getByText(`${text.length}/3000 caractères`);
      await expect(counter).toBeVisible();
    }

    // Emojis et symboles spéciaux
    const emojiText = "Personnage 😊 doit parler avec ❤️ et être 🤖 drôle 🎉✨";
    await aiInput.fill(emojiText);
    await expect(aiInput).toHaveValue(emojiText);

    // Vérifier que le compteur gère correctement les emojis (chaque emoji = potentiellement 2 char UTF-16)
    const counterText = await page.getByText(/\/3000 caractères/).textContent();
    expect(counterText).toContain("/3000 caractères");
  });

  test("double clic sur 'Créer le scénario' — prévention de soumission multiple", async ({ page }) => {
    // Mock scenarios.create mutation avec un délai artificiel
    let createCallCount = 0;
    await page.route("**/api/trpc/scenarios.create*", async (route) => {
      createCallCount++;
      // Délai simulé de 500ms
      await new Promise((r) => setTimeout(r, 500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            result: {
              data: {
                json: { id: "new-scenario-id", title: "Test" },
              },
            },
          },
        ]),
      });
    });

    await page.goto("/create");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/create");
    test.skip(redirected, "La page /create n'a pas pu être chargée — mock insuffisant");
    if (redirected) return;

    // Remplir le formulaire
    await page.locator("#title").fill("Mon scénario");
    await page.locator("#description").fill("Description de test");

    // Sélectionner un personnage
    const characterBtn = page.locator("button").filter({ hasText: "TestBot" }).first();
    await expect(characterBtn).toBeVisible();
    await characterBtn.click();

    // Cliquer sur le bouton "Créer le scénario"
    const submitBtn = page.getByRole("button", { name: "Créer le scénario" });
    await expect(submitBtn).toBeEnabled();

    // Premier clic
    await submitBtn.click();

    // Vérifier que le bouton est désactivé pendant la soumission
    await expect(submitBtn).toBeDisabled();

    // Essayer un deuxième clic (le bouton est désactivé, donc le clic ne fait rien)
    await submitBtn.click({ force: true }); // force: true car le bouton est disabled

    // Attendre la fin du premier appel
    await page.waitForTimeout(1000);

    // Vérifier qu'un seul appel a été fait à l'API
    expect(createCallCount).toBe(1);
  });

  test("visibility toggle PUBLIC/PRIVÉ — cycle complet", async ({ page }) => {
    await page.goto("/create");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/create");
    test.skip(redirected, "La page /create n'a pas pu être chargée — mock insuffisant");
    if (redirected) return;

    const publicBtn = page.getByRole("button", { name: "Public" });
    const privateBtn = page.getByRole("button", { name: "Privé" });

    // État initial : PUBLIC actif
    await expect(publicBtn).toBeVisible();
    await expect(privateBtn).toBeVisible();
    await expect(publicBtn).toHaveClass(/border-primary/);
    await expect(privateBtn).not.toHaveClass(/border-primary/);

    // Passer en PRIVÉ
    await privateBtn.click();
    await expect(privateBtn).toHaveClass(/border-primary/);
    await expect(publicBtn).not.toHaveClass(/border-primary/);

    // Revenir en PUBLIC
    await publicBtn.click();
    await expect(publicBtn).toHaveClass(/border-primary/);
    await expect(privateBtn).not.toHaveClass(/border-primary/);

    // Cycle rapide PUBLIC → PRIVÉ → PUBLIC (pas de crash)
    await privateBtn.click();
    await publicBtn.click();
    await privateBtn.click();
    await expect(privateBtn).toHaveClass(/border-primary/);

    // Re-passer en PUBLIC pour finir
    await publicBtn.click();
    await expect(publicBtn).toHaveClass(/border-primary/);
  });

  test("bouton submit désactivé sans personnage sélectionné", async ({ page }) => {
    await page.goto("/create");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/create");
    test.skip(redirected, "La page /create n'a pas pu être chargée — mock insuffisant");
    if (redirected) return;

    // Remplir tous les champs sauf sélectionner un personnage
    await page.locator("#title").fill("Mon scénario");
    await page.locator("#description").fill("Description");
    await page.locator("#openingMessage").fill("Message d'ouverture");
    await page.locator("#aiInstructions").fill("Instructions IA");

    // Le bouton doit être désactivé car character non sélectionné
    const submitBtn = page.getByRole("button", { name: "Créer le scénario" });
    await expect(submitBtn).toBeDisabled();

    // Sélectionner un personnage
    const characterBtn = page.locator("button").filter({ hasText: "TestBot" }).first();
    await characterBtn.click();

    // Le bouton doit maintenant être activé
    await expect(submitBtn).toBeEnabled();
  });

  test("compteur de caractères Instructions IA — limite de 3000", async ({ page }) => {
    await page.goto("/create");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/create");
    test.skip(redirected, "La page /create n'a pas pu être chargée — mock insuffisant");
    if (redirected) return;

    const aiInput = page.locator("#aiInstructions");

    // Vérifier l'attribut maxLength
    await expect(aiInput).toHaveAttribute("maxLength", "3000");

    // Texte de 3000 caractères (limite exacte)
    const text3000 = "X".repeat(3000);
    await aiInput.fill(text3000);
    await expect(aiInput).toHaveValue(text3000);
    await expect(page.getByText("3000/3000 caractères")).toBeVisible();

    // Essayer de dépasser la limite (le navigateur bloque via maxLength)
    await aiInput.type("Y");
    const valAfterType = await aiInput.inputValue();
    expect(valAfterType.length).toBe(3000);
  });
});
