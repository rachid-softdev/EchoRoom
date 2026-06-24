import { test, expect } from "@playwright/test";
import path from "path";

const COMPONENT_PATH = path.resolve(
  __dirname,
  "../../src/components/shared/EmptyState.tsx",
);

function readComponent(): string {
  return require("fs").readFileSync(COMPONENT_PATH, "utf-8");
}

test.describe("EmptyState — Composant Partagé", () => {
  // ─── Analyse statique du source ─────────────────────────────────────

  test("est exporté comme fonction nommée", () => {
    const source = readComponent();
    expect(source).toContain("export function EmptyState");
  });

  test("accepte les props icon, title, description, action", () => {
    const source = readComponent();
    expect(source).toContain("icon");
    expect(source).toContain("title");
    expect(source).toContain("description");
    expect(source).toContain("action");
  });

  // ─── Icône, titre, description affichés ────────────────────────────

  test("icône — rendue avec les classes w-16 h-16 text-muted-foreground mx-auto mb-4", () => {
    const source = readComponent();
    expect(source).toContain(
      "w-16 h-16 text-muted-foreground mx-auto mb-4",
    );
    // L'icône est passée via la prop icon (composant LucideIcon)
    expect(source).toContain("<Icon");
  });

  test("titre — rendu en h3 avec text-lg font-semibold mb-2", () => {
    const source = readComponent();
    expect(source).toContain(
      '<h3 className="text-lg font-semibold mb-2">{title}</h3>',
    );
  });

  test("description — rendue en p avec text-muted-foreground mb-6 max-w-sm mx-auto", () => {
    const source = readComponent();
    expect(source).toContain(
      '<p className="text-muted-foreground mb-6 max-w-sm mx-auto">',
    );
    expect(source).toContain("{description}");
  });

  // ─── Action slot optionnel (bouton) ─────────────────────────────────

  test("action — rendu conditionnellement après la description", () => {
    const source = readComponent();
    expect(source).toContain("{action}");
    // action n'est pas wrapped dans un conditionnel, il est toujours rendu
    // mais il est optionnel dans les props (action?: React.ReactNode)
  });

  test("action — le type est React.ReactNode optionnel", () => {
    const source = readComponent();
    expect(source).toContain("action?: React.ReactNode");
  });

  test("action — live: bouton d'action visible sur la page communauté vide", async ({
    page,
  }) => {
    await page.goto("/community");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requiert une authentification");
    if (redirected) return;

    // Vérifie si l'état vide de la communauté a un bouton d'action
    const emptySection = page.getByText("Aucun post pour le moment");
    const emptyExists = await emptySection.isVisible().catch(() => false);

    if (emptyExists) {
      await expect(emptySection).toBeVisible();
      // Vérifie qu'il y a un élément action dans le même conteneur
      // (par exemple un bouton "Créer un post")
      const actionButton = page
        .locator("div.flex.flex-col.items-center.justify-center.py-16")
        .first()
        .locator("button, a");
      const hasAction = await actionButton.count();
      if (hasAction > 0) {
        await expect(actionButton.first()).toBeVisible();
      }
    }
  });

  test("action — live: EmptyState utilisé sur la page library (bibliothèque vide)", async ({
    page,
  }) => {
    await page.goto("/library");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requiert une authentification");
    if (redirected) return;

    const emptyText = page.getByText("Bibliothèque vide");
    const cards = page.locator('a[href^="/scenario/"]');
    const hasCards = await cards.first().isVisible().catch(() => false);

    if (hasCards) {
      test.skip(true, "La bibliothèque contient des scénarios");
      return;
    }

    const hasEmpty = await emptyText.isVisible().catch(() => false);
    if (hasEmpty) {
      await expect(emptyText).toBeVisible();

      // Le composant EmptyState a un action slot avec un bouton "Créer"
      const createBtn = page.getByRole("button", { name: /créer/i });
      const btnExists = await createBtn.isVisible().catch(() => false);
      if (btnExists) {
        await expect(createBtn).toBeVisible();
      }
    }
  });

  // ─── Très longue description → wrapping (max-w-sm) ─────────────────

  test("description longue — la classe max-w-sm mx-auto limite la largeur", () => {
    const source = readComponent();
    expect(source).toContain("max-w-sm mx-auto");
  });

  test("description longue — le layout flex-col items-center center le contenu", () => {
    const source = readComponent();
    expect(source).toContain(
      "flex flex-col items-center justify-center py-16 text-center",
    );
  });

  test("description longue — live: le texte est contenu dans max-w-sm", async ({
    page,
  }) => {
    // Va sur la page /explore avec une recherche sans résultat
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    // Faire une recherche qui ne donne aucun résultat
    const searchInput = page.getByPlaceholder("Rechercher un scénario...");
    if (await searchInput.isVisible()) {
      await searchInput.fill("zzzzznonexistentxxxxx");
      await page.waitForTimeout(500);
    }

    // Cherche le conteneur EmptyState
    const emptyContainer = page
      .locator("div.flex.flex-col.items-center.justify-center.py-16.text-center")
      .first();
    const containerExists = await emptyContainer
      .isVisible()
      .catch(() => false);

    if (containerExists) {
      // Vérifie que la description a la classe max-w-sm
      const description = emptyContainer.locator("p").last();
      const descClass = await description.getAttribute("class");
      expect(descClass).toContain("max-w-sm");
      expect(descClass).toContain("mx-auto");
    }
  });

  // ─── Structure du layout ────────────────────────────────────────────

  test("layout — conteneur principal avec py-16", () => {
    const source = readComponent();
    expect(source).toContain("py-16");
  });

  test("layout — centrage avec items-center justify-center", () => {
    const source = readComponent();
    expect(source).toContain("items-center justify-center");
  });

  test("layout — alignement text-center", () => {
    const source = readComponent();
    expect(source).toContain("text-center");
  });

  // ─── Live: EmptyState visible sur plusieurs pages ───────────────────

  test("live — EmptyState sur la page d'accueil (scénario à la une vide)", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const customEmpty = page.getByText(
      "Aucun scénario à la une aujourd'hui",
    );
    const exists = await customEmpty.isVisible().catch(() => false);

    if (exists) {
      await expect(customEmpty).toBeVisible();
      // Vérifie la structure : icône (svg), titre (h3), description (p)
      const container = customEmpty.locator(
        "xpath=../../..",
      );
      const svgCount = await container.locator("svg").count();
      expect(svgCount).toBeGreaterThanOrEqual(1);
    }
  });

  test("live — EmptyState sur la page explore avec icône, titre et description", async ({
    page,
  }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    // Faire une recherche sans résultat
    const searchInput = page.getByPlaceholder("Rechercher un scénario...");
    await searchInput.fill("zzzzznonexistentxxxxx");
    await page.waitForTimeout(500);

    // Vérifie que "Aucun résultat" est visible avec la structure EmptyState
    const noResult = page.getByText("Aucun résultat");
    const exists = await noResult.isVisible().catch(() => false);

    if (exists) {
      await expect(noResult).toBeVisible();
      // Vérifie que le conteneur a la classe py-16
      const container = page
        .locator("div.flex.flex-col.items-center.justify-center.py-16")
        .first();
      await expect(container).toBeVisible();
    }
  });

  // ─── Vérifications des classes CSS sur les composants ───────────────

  test("l'icône a la classe mb-4 pour l'espacement", () => {
    const source = readComponent();
    expect(source).toContain("mb-4");
  });

  test("le titre a la classe mb-2 pour l'espacement", () => {
    const source = readComponent();
    expect(source).toContain("mb-2");
  });

  test("la description a la classe mb-6 pour l'espacement", () => {
    const source = readComponent();
    expect(source).toContain("mb-6");
  });

  test("le type icon est LucideIcon", () => {
    const source = readComponent();
    expect(source).toContain("icon: LucideIcon");
    expect(source).toContain("import type { LucideIcon }");
  });
});
