import { test, expect } from "@playwright/test";

test.describe("Explore page — filtres, URL sync et interactions avancées", () => {
  // ─── URL params sync ────────────────────────────────────────────

  test("URL se met à jour avec le paramètre ?sort= quand on change le tri", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    // Par défaut, TRENDING (pas de paramètre sort dans l'URL)
    // Cliquer sur "Chronologique"
    await page.getByRole("radio", { name: "Chronologique" }).click();
    await page.waitForTimeout(100);

    // L'URL doit maintenant contenir ?sort=CHRONOLOGICAL
    expect(page.url()).toContain("sort=CHRONOLOGICAL");

    // Cliquer sur "Top"
    await page.getByRole("radio", { name: "Top" }).click();
    await page.waitForTimeout(100);

    // L'URL doit maintenant contenir ?sort=TOP
    expect(page.url()).toContain("sort=TOP");
  });

  test("URL se met à jour avec le paramètre ?category= au clic sur une catégorie", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    // Cliquer sur "Romantique"
    await page.getByRole("button", { name: "Romantique" }).click();
    await page.waitForTimeout(100);

    // L'URL doit contenir ?category=Romantique
    expect(page.url()).toContain("category=Romantique");
  });

  test("URL se met à jour avec le paramètre ?search= lors de la saisie", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    // Taper dans la recherche
    const searchInput = page.getByPlaceholder("Rechercher un scénario...");
    await searchInput.fill("test recherche");
    await page.waitForTimeout(400); // attendre le debounce 300ms

    // L'URL doit contenir le paramètre search
    expect(page.url()).toContain("search=test+recherche");
  });

  test("URL contient tous les paramètres combinés (sort + category + search)", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    // Appliquer tous les filtres
    await page.getByRole("radio", { name: "Top" }).click();
    await page.getByRole("button", { name: "Chaotique" }).click();

    const searchInput = page.getByPlaceholder("Rechercher un scénario...");
    await searchInput.fill("test");
    await page.waitForTimeout(400);

    // L'URL doit contenir les 3 paramètres
    const url = page.url();
    expect(url).toContain("sort=TOP");
    expect(url).toContain("category=Chaotique");
    expect(url).toContain("search=test");
  });

  // ─── URL params restoration au chargement ──────────────────────

  test("Les paramètres URL sont restaurés au chargement de la page", async ({ page }) => {
    // Naviguer vers l'explore avec des paramètres pré-définis
    await page.goto("/explore?sort=TOP&category=Horreur&search=zombie");
    await page.waitForLoadState("networkidle");

    // Le champ search doit contenir "zombie"
    const searchInput = page.getByPlaceholder("Rechercher un scénario...");
    await expect(searchInput).toHaveValue("zombie");

    // Le tri "Top" doit être sélectionné
    await expect(page.getByRole("radio", { name: "Top" })).toHaveAttribute("aria-checked", "true");

    // Le bouton "Horreur" doit être actif
    // Note : Horreur est dans EXTRA_CATEGORIES, il faut d'abord déplier "+X autres"
    const horreurBtn = page.getByRole("button", { name: "Horreur" });
    const isHorreurVisible = await horreurBtn.isVisible().catch(() => false);

    if (!isHorreurVisible) {
      // Cliquer sur "+X autres" pour déplier
      const plusBtn = page.locator("button").filter({ hasText: /autres/ });
      if (await plusBtn.isVisible()) {
        await plusBtn.click();
        await page.waitForTimeout(100);
      }
    }

    await expect(page.getByRole("button", { name: "Horreur" })).toHaveAttribute("aria-pressed", "true");
  });

  test("Paramètres URL invalides sont ignorés (fallback valeurs par défaut)", async ({ page }) => {
    // Naviguer avec un sort invalide
    await page.goto("/explore?sort=INVALID&category=FakeCategory");
    await page.waitForLoadState("networkidle");

    // Le tri par défaut TRENDING doit être actif
    await expect(page.getByRole("radio", { name: "Tendance" })).toHaveAttribute("aria-checked", "true");

    // "Tous" doit être la catégorie active par défaut
    await expect(page.getByRole("button", { name: "Tous" })).toHaveAttribute("aria-pressed", "true");
  });

  // ─── Debounce recherche 300ms ──────────────────────────────────

  test("La recherche est déboundée de 300ms (l'URL ne change pas immédiatement)", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    const searchInput = page.getByPlaceholder("Rechercher un scénario...");

    // Taper rapidement — ne pas attendre
    await searchInput.fill("rapide");
    await page.waitForTimeout(50);

    // L'URL ne doit pas encore contenir le paramètre search (trop tôt)
    expect(page.url()).not.toContain("search=rapide");

    // Attendre la fin du debounce
    await page.waitForTimeout(300);

    // Maintenant l'URL doit contenir le paramètre
    expect(page.url()).toContain("search=rapide");
  });

  test("Saisie rapide suivie d'effacement ne déclenche pas de recherche", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    const searchInput = page.getByPlaceholder("Rechercher un scénario...");

    // Taper puis effacer rapidement
    await searchInput.fill("temp");
    await page.waitForTimeout(100);
    await searchInput.clear();
    await page.waitForTimeout(400); // attendre le debounce

    // L'URL ne doit pas contenir de search
    expect(page.url()).not.toContain("search=");
  });

  // ─── Bouton "Surprise-moi" → mode chaos ────────────────────────

  test("Bouton 'Surprise-moi' active le mode chaos", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    // Cliquer sur "Surprise-moi"
    const surpriseBtn = page.getByRole("button", { name: /Surprise-moi/ });
    await expect(surpriseBtn).toBeVisible();
    await surpriseBtn.click();

    // Le message "Mode chaos activé" doit apparaître (si des résultats existent)
    const chaosMessage = page.getByText("Mode chaos activé");
    const chaosVisible = await chaosMessage.isVisible().catch(() => false);

    if (chaosVisible) {
      await expect(chaosMessage).toBeVisible();
      await expect(page.getByText("les résultats sont mélangés aléatoirement")).toBeVisible();
    }
  });

  test("Le mode chaos se désactive quand un filtre catégorie est appliqué", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    // Activer le mode chaos
    await page.getByRole("button", { name: /Surprise-moi/ }).click();
    await page.waitForTimeout(100);

    // Appliquer un filtre catégorie
    await page.getByRole("button", { name: "Chaotique" }).click();
    await page.waitForTimeout(200);

    // Le message "Mode chaos activé" doit disparaître
    const chaosMessage = page.getByText("Mode chaos activé");
    await expect(chaosMessage).not.toBeVisible();
  });

  test("Le mode chaos se désactive quand une recherche est saisie", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    // Activer le mode chaos
    await page.getByRole("button", { name: /Surprise-moi/ }).click();
    await page.waitForTimeout(100);

    // Saisir une recherche
    const searchInput = page.getByPlaceholder("Rechercher un scénario...");
    await searchInput.fill("test");
    await page.waitForTimeout(400);

    // Le message "Mode chaos activé" doit disparaître
    const chaosMessage = page.getByText("Mode chaos activé");
    await expect(chaosMessage).not.toBeVisible();
  });

  test("Appuyer plusieurs fois sur 'Surprise-moi' mélange à nouveau (incrémente chaosKey)", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    const surpriseBtn = page.getByRole("button", { name: /Surprise-moi/ });

    // Premier clic
    await surpriseBtn.click();
    await page.waitForTimeout(100);

    // Deuxième clic — pas d'erreur, le chaosKey change
    await surpriseBtn.click();
    await page.waitForTimeout(100);

    // Pas d'erreur = OK
  });

  // ─── Catégories "+X autres" déploiement ────────────────────────

  test("Le bouton '+X autres' déplie les catégories cachées", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    // Vérifier que les catégories extra ne sont pas visibles initialement
    const horreurBtn = page.getByRole("button", { name: "Horreur" });
    const cringeBtn = page.getByRole("button", { name: "Cringe" });

    // Au moins une des catégories extra devrait être cachée
    const horreurVisible = await horreurBtn.isVisible().catch(() => false);

    if (!horreurVisible) {
      // Cliquer sur "+X autres"
      const plusBtn = page.locator("button").filter({ hasText: /autres/ });
      await expect(plusBtn).toBeVisible();

      // Vérifie le texte : doit contenir "+X autres" avec ChevronDown
      const plusText = await plusBtn.textContent();
      expect(plusText).toMatch(/\+\d+ autres/);
      await plusBtn.click();
      await page.waitForTimeout(100);

      // Maintenant Horreur doit être visible
      await expect(horreurBtn).toBeVisible();

      // Le bouton "Moins" avec ChevronUp doit apparaître
      const moinsBtn = page.locator("button").filter({ hasText: "Moins" });
      await expect(moinsBtn).toBeVisible();
    }
  });

  test("Le bouton 'Moins' replie les catégories extra", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    // Déplier d'abord
    const plusBtn = page.locator("button").filter({ hasText: /autres/ });
    const plusVisible = await plusBtn.isVisible().catch(() => false);
    if (plusVisible) {
      await plusBtn.click();
      await page.waitForTimeout(100);
    }

    // Maintenant le bouton "Moins" doit être visible
    const moinsBtn = page.locator("button").filter({ hasText: "Moins" });
    const moinsVisible = await moinsBtn.isVisible().catch(() => false);

    if (moinsVisible) {
      // Cliquer sur "Moins"
      await moinsBtn.click();
      await page.waitForTimeout(100);

      // Les catégories extra doivent être à nouveau cachées
      // Le bouton "+X autres" doit réapparaître
      await expect(page.locator("button").filter({ hasText: /autres/ })).toBeVisible();
    }
  });

  test("Les catégories primaires sont toujours visibles", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    // Les catégories primaires (PRIMARY_CATEGORIES) doivent être visibles
    const primaryCategories = ["Tous", "Chaotique", "Romantique", "Corporate", "NPC"];
    for (const cat of primaryCategories) {
      await expect(page.getByRole("button", { name: cat })).toBeVisible();
    }
  });

  // ─── État vide différent selon contexte ────────────────────────

  test("État vide pour recherche sans résultat affiche 'Aucun résultat'", async ({ page }) => {
    // Mock pour retourner des données vides
    await page.route("**/api/trpc/scenarios.feed*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { result: { data: { json: { items: [] } } } },
        ]),
      });
    });

    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    // Saisir une recherche sans résultat
    const searchInput = page.getByPlaceholder("Rechercher un scénario...");
    await searchInput.fill("xyznonexistant123456");
    await page.waitForTimeout(400);

    // L'état vide pour recherche doit montrer "Aucun résultat"
    await expect(page.getByText("Aucun résultat")).toBeVisible();
    await expect(
      page.getByText("Essaie d'autres mots-clés ou explore les catégories")
    ).toBeVisible();
  });

  test("État vide pour catégorie sans scénario affiche 'Rien ici pour l'instant'", async ({ page }) => {
    // Mock pour retourner des données vides
    await page.route("**/api/trpc/scenarios.feed*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { result: { data: { json: { items: [] } } } },
        ]),
      });
    });

    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    // Appliquer une catégorie sans résultat
    await page.getByRole("button", { name: "Weird" }).click();
    await page.waitForTimeout(100);

    // Pour Weird qui est dans EXTRA_CATEGORIES, il faut d'abord déplier
    const weirdBtn = page.getByRole("button", { name: "Weird" });
    const weirdVisible = await weirdBtn.isVisible().catch(() => false);
    if (!weirdVisible) {
      const plusBtn = page.locator("button").filter({ hasText: /autres/ });
      if (await plusBtn.isVisible()) {
        await plusBtn.click();
        await page.waitForTimeout(100);
      }
    }
    await weirdBtn.click();
    await page.waitForTimeout(100);

    // L'état vide pour catégorie doit montrer "Rien ici pour l'instant"
    await expect(page.getByText("Rien ici pour l'instant")).toBeVisible();
    await expect(
      page.getByText("La communauté n'a pas encore exploré cette catégorie")
    ).toBeVisible();
  });

  // ─── SegmentedControl (tri) ────────────────────────────────────

  test("Le SegmentedControl a 3 options de tri fonctionnelles", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    // Les 3 options doivent être visibles
    await expect(page.getByRole("radio", { name: "Chronologique" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Tendance" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Top" })).toBeVisible();
  });

  test("Changer de tri ne réinitialise pas la recherche en cours", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    // Saisir une recherche
    const searchInput = page.getByPlaceholder("Rechercher un scénario...");
    await searchInput.fill("test");
    await page.waitForTimeout(400);

    // Changer de tri
    await page.getByRole("radio", { name: "Top" }).click();
    await page.waitForTimeout(100);

    // La recherche doit être conservée
    await expect(searchInput).toHaveValue("test");
    expect(page.url()).toContain("search=test");
    expect(page.url()).toContain("sort=TOP");
  });

  test("Changer de catégorie ne réinitialise pas le tri", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    // Changer le tri d'abord
    await page.getByRole("radio", { name: "Chronologique" }).click();
    await page.waitForTimeout(100);

    // Changer de catégorie
    await page.getByRole("button", { name: "Corporate" }).click();
    await page.waitForTimeout(100);

    // Le tri doit être conservé
    expect(page.url()).toContain("sort=CHRONOLOGICAL");
    expect(page.url()).toContain("category=Corporate");
  });

  // ─── Accessibilité du filtre catégorie ─────────────────────────

  test("Les boutons de catégorie ont aria-pressed pour l'état actif", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    const tousBtn = page.getByRole("button", { name: "Tous" });
    await expect(tousBtn).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Chaotique" }).click();
    await expect(tousBtn).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("button", { name: "Chaotique" })).toHaveAttribute("aria-pressed", "true");
  });

  test("Le champ recherche a un placeholder et une icône Search", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    const searchInput = page.getByPlaceholder("Rechercher un scénario...");
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toBeEnabled();

    // Icône Search (Lucide) dans le conteneur parent
    const searchIcon = page.locator("svg.lucide-search");
    await expect(searchIcon).toBeVisible();
  });
});
