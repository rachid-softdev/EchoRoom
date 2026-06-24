import { test, expect } from "@playwright/test";

test.describe("PasswordStrengthMeter — Composant Partagé", () => {
  test.beforeEach(async ({ page }) => {
    // Navigue vers la page d'inscription où le composant est utilisé
    await page.goto("/register");
    await page.waitForLoadState("networkidle");
  });

  // ─── Password vide → mètre caché ────────────────────────────────────

  test("password vide → le mètre n'est pas rendu (retourne null)", async ({
    page,
  }) => {
    const passwordInput = page.locator("#password");
    await expect(passwordInput).toBeVisible();

    // Avec un champ vide, le composant retourne null
    // Le texte "Force :" ne doit pas apparaître
    const strengthLabel = page.getByText("Force :");
    await expect(strengthLabel).toHaveCount(0);

    // Les barres ne doivent pas être visibles
    const bars = page.locator('[class*="h-1.5"][class*="flex-1"]');
    await expect(bars).toHaveCount(0);
  });

  // ─── Score 0 (1 char) → "Très faible", 5 barres bg-muted ────────────

  test("score 0 (1 caractère) → label 'Très faible' et 5 barres bg-muted", async ({
    page,
  }) => {
    const passwordInput = page.locator("#password");
    await passwordInput.fill("a");

    // Label "Force : Très faible"
    await expect(page.getByText("Force : Très faible")).toBeVisible();

    // 5 barres visibles
    const bars = page.locator('[class*="h-1.5"][class*="flex-1"]');
    await expect(bars).toHaveCount(5);

    // Toutes les barres ont la classe bg-muted (score = 0, aucune colorée)
    for (let i = 0; i < 5; i++) {
      await expect(bars.nth(i)).toHaveClass(/bg-muted/);
    }
  });

  // ─── Score 5 (Abcdef1!@#$) → "Très fort", 5 barres colorées ────────

  test("score 5 (Abcdef1!@#$) → label 'Très fort' et 5 barres colorées", async ({
    page,
  }) => {
    const passwordInput = page.locator("#password");
    await passwordInput.fill("Abcdef1!@#$");

    // Label
    await expect(page.getByText("Force : Très fort")).toBeVisible();

    // 5 barres
    const bars = page.locator('[class*="h-1.5"][class*="flex-1"]');
    await expect(bars).toHaveCount(5);

    // Chaque barre a sa couleur respective (index < score = 5, toutes colorées)
    await expect(bars.nth(0)).toHaveClass(/bg-destructive/);
    await expect(bars.nth(1)).toHaveClass(/bg-orange-500/);
    await expect(bars.nth(2)).toHaveClass(/bg-yellow-500/);
    await expect(bars.nth(3)).toHaveClass(/bg-lime-500/);
    await expect(bars.nth(4)).toHaveClass(/bg-green-500/);
  });

  // ─── Checks individuels ✓/✗ visibles ────────────────────────────────

  test("affiche 5 checks individuels dans une liste", async ({ page }) => {
    const passwordInput = page.locator("#password");
    await passwordInput.fill("a");

    const checks = page.locator("ul > li");
    await expect(checks).toHaveCount(5);

    // Vérifie les libellés de chaque check
    const checkLabels = [
      "8 caractères minimum",
      "12 caractères minimum",
      "Une lettre majuscule",
      "Un chiffre",
      "Un caractère spécial",
    ];

    for (const label of checkLabels) {
      await expect(page.getByText(label)).toBeVisible();
    }
  });

  test("checks individuels — ✗ quand le check échoue, ✓ quand il réussit", async ({
    page,
  }) => {
    const passwordInput = page.locator("#password");
    const checks = () => page.locator("ul > li");

    // Avec "a", tous les checks échouent → tous ✗
    await passwordInput.fill("a");
    for (let i = 0; i < 5; i++) {
      const iconSpan = checks().nth(i).locator("span").first();
      await expect(iconSpan).toHaveText("✗");
      await expect(iconSpan).toHaveClass(/text-destructive/);
    }

    // Avec "Abcdef1!@#$", tous les checks réussissent → tous ✓
    await passwordInput.fill("Abcdef1!@#$");
    for (let i = 0; i < 5; i++) {
      const iconSpan = checks().nth(i).locator("span").first();
      await expect(iconSpan).toHaveText("✓");
      await expect(iconSpan).toHaveClass(/text-green-500/);
    }
  });

  test("check '8 caractères minimum' — ✗ pour 7, ✓ pour 8", async ({
    page,
  }) => {
    const passwordInput = page.locator("#password");

    // 7 caractères
    await passwordInput.fill("abcdefg");
    const check8 = page.getByText("8 caractères minimum");
    await expect(
      check8.locator("xpath=..").locator("span").first(),
    ).toHaveClass(/text-destructive/);

    // 8 caractères
    await passwordInput.fill("abcdefgh");
    await expect(
      check8.locator("xpath=..").locator("span").first(),
    ).toHaveClass(/text-green-500/);
  });

  test("check '12 caractères minimum' — ✗ pour 11, ✓ pour 12", async ({
    page,
  }) => {
    const passwordInput = page.locator("#password");

    // 11 caractères
    await passwordInput.fill("abcdefghijk");
    const check12 = page.getByText("12 caractères minimum");
    await expect(
      check12.locator("xpath=..").locator("span").first(),
    ).toHaveClass(/text-destructive/);

    // 12 caractères
    await passwordInput.fill("abcdefghijkl");
    await expect(
      check12.locator("xpath=..").locator("span").first(),
    ).toHaveClass(/text-green-500/);
  });

  test("check 'Une lettre majuscule' — ✗ sans majuscule, ✓ avec majuscule", async ({
    page,
  }) => {
    const passwordInput = page.locator("#password");

    // Sans majuscule
    await passwordInput.fill("abcdefgh1");
    const upperCheck = page.getByText("Une lettre majuscule");
    await expect(
      upperCheck.locator("xpath=..").locator("span").first(),
    ).toHaveClass(/text-destructive/);

    // Avec majuscule
    await passwordInput.fill("Abcdefgh1");
    await expect(
      upperCheck.locator("xpath=..").locator("span").first(),
    ).toHaveClass(/text-green-500/);
  });

  test("check 'Un chiffre' — ✗ sans chiffre, ✓ avec chiffre", async ({
    page,
  }) => {
    const passwordInput = page.locator("#password");

    // Sans chiffre
    await passwordInput.fill("abcdefgh");
    const digitCheck = page.getByText("Un chiffre");
    await expect(
      digitCheck.locator("xpath=..").locator("span").first(),
    ).toHaveClass(/text-destructive/);

    // Avec chiffre
    await passwordInput.fill("abcdefgh1");
    await expect(
      digitCheck.locator("xpath=..").locator("span").first(),
    ).toHaveClass(/text-green-500/);
  });

  test("check 'Un caractère spécial' — ✗ sans spécial, ✓ avec spécial", async ({
    page,
  }) => {
    const passwordInput = page.locator("#password");

    // Sans caractère spécial
    await passwordInput.fill("Abcdefgh1");
    const specialCheck = page.getByText("Un caractère spécial");
    await expect(
      specialCheck.locator("xpath=..").locator("span").first(),
    ).toHaveClass(/text-destructive/);

    // Avec caractère spécial
    await passwordInput.fill("Abcdef1!@");
    await expect(
      specialCheck.locator("xpath=..").locator("span").first(),
    ).toHaveClass(/text-green-500/);
  });

  // ─── Mise à jour en temps réel au fur et à mesure de la frappe ──────

  test("score et checks se mettent à jour en temps réel quand on tape", async ({
    page,
  }) => {
    const passwordInput = page.locator("#password");

    // Commence vide → mètre caché
    await expect(page.getByText("Force :")).toHaveCount(0);

    // Tape "a" → score 0 → Très faible
    await passwordInput.fill("a");
    await expect(page.getByText("Force : Très faible")).toBeVisible();

    // Étend à "abcdefgh" → score 1 (longueur >= 8) → Faible
    await passwordInput.fill("abcdefgh");
    await expect(page.getByText("Force : Faible")).toBeVisible();

    // Ajoute 1 → "abcdefgh1" → score 2 (8 + chiffre) → Moyen
    await passwordInput.fill("abcdefgh1");
    await expect(page.getByText("Force : Moyen")).toBeVisible();

    // Ajoute majuscule → "Abcdefgh1" → score 3 → Fort
    await passwordInput.fill("Abcdefgh1");
    await expect(page.getByText("Force : Fort")).toBeVisible();

    // Ajoute spécial → "Abcdef1!@" → score 4 → Très fort
    await passwordInput.fill("Abcdef1!@");
    await expect(page.getByText("Force : Très fort")).toBeVisible();

    // Ajoute plus de spéciaux → "Abcdef1!@#$" → score 5 → Très fort (max)
    await passwordInput.fill("Abcdef1!@#$");
    await expect(page.getByText("Force : Très fort")).toBeVisible();

    // Efface → le mètre disparaît
    await passwordInput.fill("");
    await expect(page.getByText("Force :")).toHaveCount(0);
  });

  test("le score baisse quand on supprime des caractères", async ({
    page,
  }) => {
    const passwordInput = page.locator("#password");

    // Mot de passe fort
    await passwordInput.fill("Abcdef1!@#$");
    await expect(page.getByText("Force : Très fort")).toBeVisible();

    // Supprime progressivement pour arriver à faible
    await passwordInput.fill("a");
    await expect(page.getByText("Force : Très faible")).toBeVisible();

    // Puis vide
    await passwordInput.fill("");
    await expect(page.getByText("Force :")).toHaveCount(0);
  });

  // ─── Structure des barres de score ──────────────────────────────────

  test("les barres sont dans un conteneur flex avec gap-1", async ({
    page,
  }) => {
    const passwordInput = page.locator("#password");
    await passwordInput.fill("Abcdef1!@#$");

    // Le conteneur des barres est un div.flex.gap-1
    const barContainer = page.locator("div.flex.gap-1");
    await expect(barContainer).toBeVisible();

    // Il contient 5 enfants div
    const barChildren = barContainer.locator("> div");
    await expect(barChildren).toHaveCount(5);
  });

  test("les barres ont les classes de base h-1.5 flex-1 rounded-full", async ({
    page,
  }) => {
    const passwordInput = page.locator("#password");
    await passwordInput.fill("Abcdef1!@#$");

    const bars = page.locator('[class*="h-1.5"][class*="flex-1"]');
    await expect(bars).toHaveCount(5);

    for (let i = 0; i < 5; i++) {
      await expect(bars.nth(i)).toHaveClass(/rounded-full/);
    }
  });

  // ─── Structure du layout ────────────────────────────────────────────

  test("le composant a un conteneur space-y-2", async ({ page }) => {
    const passwordInput = page.locator("#password");
    await passwordInput.fill("abc");

    const container = page.locator("div.space-y-2").first();
    await expect(container).toBeVisible();
  });

  test("le label 'Force :' s'affiche en texte muted et petite taille", async ({
    page,
  }) => {
    const passwordInput = page.locator("#password");
    await passwordInput.fill("abc");

    const label = page.getByText(/^Force :/);
    await expect(label).toBeVisible();
    // Vérifie la classe text-xs text-muted-foreground
    const labelSpan = label.locator("xpath=..");
    // Le <p> parent a text-xs text-muted-foreground
    await expect(labelSpan).toHaveClass(/text-xs/);
    await expect(labelSpan).toHaveClass(/text-muted-foreground/);
  });
});
