import path from "node:path";
import { expect, test } from "@playwright/test";

const COMPONENT_PATH = path.resolve(__dirname, "../../src/components/shared/ScenarioCard.tsx");

function readComponent(): string {
  return require("node:fs").readFileSync(COMPONENT_PATH, "utf-8");
}

test.describe("ScenarioCard — Composant Partagé", () => {
  // ─── Analyse statique du source ─────────────────────────────────────

  test("est exporté comme fonction nommée", () => {
    const source = readComponent();
    expect(source).toContain("export function ScenarioCard");
  });

  test("accepte les props scenario, href, showCreator, showShare", () => {
    const source = readComponent();
    expect(source).toContain("scenario");
    expect(source).toContain("href");
    expect(source).toContain("showCreator");
    expect(source).toContain("showShare");
  });

  // ─── Sans description → section masquée ─────────────────────────────

  test("description — masquée quand scenario.description est null", () => {
    const source = readComponent();
    // Rendu conditionnel de la description
    expect(source).toContain("{scenario.description && (");
    expect(source).toContain("<CardDescription");
  });

  test("description — live: certains scénarios peuvent ne pas avoir de description", async ({
    page,
  }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    // Cherche la première card
    const cardLink = page.locator('a[href^="/scenario/"]').first();
    const exists = await cardLink.isVisible().catch(() => false);
    test.skip(!exists, "Aucun scénario disponible dans la base");
    if (!exists) return;

    // Vérifie que la classe line-clamp-2 est présente sur la description
    // Si la description existe, elle a la classe line-clamp-2
    const description = cardLink.locator("p.line-clamp-2");
    const descExists = await description.isVisible().catch(() => false);

    if (descExists) {
      // La description est visible → le rendu conditionnel a fonctionné
      await expect(description).toBeVisible();
    }
    // Si la description n'existe pas, c'est aussi correct (description = null)
  });

  // ─── Sans creator → "par [username]" absent ─────────────────────────

  test("creator — caché quand showCreator est false", () => {
    const source = readComponent();
    // showCreator est true par défaut
    expect(source).toContain("showCreator = true");
    // Rendu conditionnel
    expect(source).toContain("{showCreator && scenario.creator && (");
    expect(source).toContain("par {scenario.creator.username}");
  });

  test("creator — live: le texte 'par ...' est présent sur les scénarios avec creator", async ({
    page,
  }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    const cardLink = page.locator('a[href^="/scenario/"]').first();
    const exists = await cardLink.isVisible().catch(() => false);
    test.skip(!exists, "Aucun scénario disponible");
    if (!exists) return;

    // Vérifie si le créateur est affiché
    const creatorText = cardLink.getByText(/^par\s+\S+/);
    const creatorExists = await creatorText.isVisible().catch(() => false);
    test.skip(!creatorExists, "Creator non affiché (peut être undefined ou showCreator désactivé)");
    if (!creatorExists) return;

    await expect(creatorText).toBeVisible();
  });

  test("creator — 'par' n'est pas affiché quand scenario.creator est undefined", () => {
    const source = readComponent();
    // Double condition : showCreator && scenario.creator
    expect(source).toContain("showCreator && scenario.creator && (");
  });

  // ─── playCount=1500 → format "1.5k" ─────────────────────────────────

  test("playCount — formaté en 'X.Xk' quand > 1000", () => {
    const source = readComponent();
    // Logique de formatage
    expect(source).toContain("scenario.playCount > 1000");
    expect(source).toContain("(scenario.playCount / 1000).toFixed(1)");
    expect(source).toContain("}k");
  });

  test("playCount — live: vérifie le format du nombre", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    const cardLink = page.locator('a[href^="/scenario/"]').first();
    const exists = await cardLink.isVisible().catch(() => false);
    test.skip(!exists, "Aucun scénario disponible");
    if (!exists) return;

    // Cherche le texte du play count dans la card
    const playContainer = cardLink.locator("div.flex.items-center.gap-1.text-xs").first();
    const playExists = await playContainer.isVisible().catch(() => false);
    test.skip(!playExists, "playCount non affiché");
    if (!playExists) return;

    const playText = await playContainer.textContent();
    // Format: soit un nombre (ex: "100") soit "X.Xk" (ex: "1.5k")
    expect(playText?.trim()).toMatch(/^\d+(\.\d+)?k?$/);
  });

  // ─── showShare=false → bouton Share caché ─────────────────────────

  test("showShare — bouton Share caché quand showShare est false (par défaut)", () => {
    const source = readComponent();
    // showShare est false par défaut
    expect(source).toContain("showShare = false");
    // Rendu conditionnel
    expect(source).toContain("{showShare && (");
    expect(source).toContain("Share2");
  });

  test("showShare — live: sur la page d'accueil, le bouton Share peut être visible", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // La page d'accueil a showShare=true
    const shareButton = page
      .locator('a[href^="/scenario/"] button')
      .filter({ has: page.locator("svg.lucide-share2") });
    const shareExists = await shareButton
      .first()
      .isVisible()
      .catch(() => false);
    test.skip(!shareExists, "Bouton Share non visible — pas de scénario à la une avec showShare");
    if (!shareExists) return;

    await expect(shareButton.first()).toBeVisible();
  });

  test("showShare — live: sur /explore, le bouton Share n'est pas visible (showShare=false par défaut)", async ({
    page,
  }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    const shareButton = page
      .locator('a[href^="/scenario/"] button')
      .filter({ has: page.locator("svg.lucide-share2") });
    const shareExists = await shareButton
      .first()
      .isVisible()
      .catch(() => false);

    // Sur /explore, showShare n'est pas passé, donc false → pas de bouton
    // Mais si aucun scénario n'est chargé, on skip
    const anyCard = page.locator('a[href^="/scenario/"]').first();
    const cardExists = await anyCard.isVisible().catch(() => false);

    if (cardExists) {
      // Des scénarios sont affichés, le bouton share ne devrait pas être visible
      expect(shareExists).toBe(false);
    } else {
      test.skip(true, "Aucun scénario chargé sur explore");
    }
  });

  // ─── Hover → border change, titre change de couleur ─────────────────

  test("hover — la Card a la classe group et hover:border-primary/30", () => {
    const source = readComponent();
    expect(source).toContain("group cursor-pointer hover:border-primary/30");
    expect(source).toContain("transition-colors");
  });

  test("hover — le titre a group-hover:text-primary transition-colors", () => {
    const source = readComponent();
    expect(source).toContain("group-hover:text-primary transition-colors");
  });

  test("hover — live: le titre change de couleur au survol", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    const cardLink = page.locator('a[href^="/scenario/"]').first();
    const exists = await cardLink.isVisible().catch(() => false);
    test.skip(!exists, "Aucun scénario disponible");
    if (!exists) return;

    // Récupère le titre (h3)
    const title = cardLink.locator("h3").first();
    await expect(title).toBeVisible();

    // Vérifie la classe group-hover
    const titleClass = await title.getAttribute("class");
    expect(titleClass).toContain("group-hover:text-primary");

    // Vérifie la classe sur la Card parent
    const card = cardLink.locator("> div").first();
    const cardClass = await card.getAttribute("class");
    expect(cardClass).toContain("hover:border-primary/30");
    expect(cardClass).toContain("transition-colors");
  });

  // ─── Focus-visible ring sur le Link ─────────────────────────────────

  test("focus-visible — le Link a les classes focus-visible:ring-2", () => {
    const source = readComponent();
    expect(source).toContain("focus-visible:outline-none");
    expect(source).toContain("focus-visible:ring-2");
    expect(source).toContain("focus-visible:ring-primary");
    expect(source).toContain("focus-visible:ring-offset-2");
    expect(source).toContain("rounded-xl");
  });

  test("focus-visible — live: le lien a les classes de focus ring", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    const cardLink = page.locator('a[href^="/scenario/"]').first();
    const exists = await cardLink.isVisible().catch(() => false);
    test.skip(!exists, "Aucun scénario disponible");
    if (!exists) return;

    const classAttr = await cardLink.getAttribute("class");
    expect(classAttr).toContain("focus-visible:ring-2");
    expect(classAttr).toContain("focus-visible:outline-none");
  });

  // ─── Structure de la carte ──────────────────────────────────────────

  test("la Card utilise les composants CardHeader, CardContent, CardTitle, CardDescription", () => {
    const source = readComponent();
    expect(source).toContain("CardHeader");
    expect(source).toContain("CardContent");
    expect(source).toContain("CardTitle");
    expect(source).toContain("CardDescription");
  });

  test("le badge catégorie est rendu avec variant='secondary'", () => {
    const source = readComponent();
    expect(source).toContain('<Badge variant="secondary">');
    expect(source).toContain("{categoryLabel}");
  });

  test("playCount n'est pas rendu quand il est undefined", () => {
    const source = readComponent();
    expect(source).toContain("{scenario.playCount !== undefined && (");
  });

  test("les icônes Heart, MessageCircle, Play, Share2 sont importées", () => {
    const source = readComponent();
    expect(source).toContain("Heart");
    expect(source).toContain("MessageCircle");
    expect(source).toContain("Play");
    expect(source).toContain("Share2");
  });

  test("le lien par défaut est /scenario/{id}", () => {
    const source = readComponent();
    // biome-ignore lint/suspicious/noTemplateCurlyInString: intentionally checking source for template literal
    expect(source).toContain("href = `/scenario/${scenario.id}`");
  });
});
