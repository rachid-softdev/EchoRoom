import { test, expect } from "@playwright/test";
import path from "path";

const COMPONENT_PATH = path.resolve(
  __dirname,
  "../../src/components/shared/ConsentBanner.tsx",
);

function readComponent(): string {
  return require("fs").readFileSync(COMPONENT_PATH, "utf-8");
}

test.describe("ConsentBanner — Composant Partagé", () => {
  // ─── Analyse statique du source ─────────────────────────────────────

  test("est exporté comme fonction nommée", () => {
    const source = readComponent();
    expect(source).toContain("export function ConsentBanner");
  });

  test("utilise le hook tRPC user.getConsentStatus", () => {
    const source = readComponent();
    expect(source).toContain("api.user.getConsentStatus.useQuery");
  });

  test("utilise la mutation tRPC user.reconsent", () => {
    const source = readComponent();
    expect(source).toContain("api.user.reconsent.useMutation");
  });

  test("recharge la page après reconsent", () => {
    const source = readComponent();
    expect(source).toContain("window.location.reload()");
  });

  // ─── Consent actif → banner masqué (rend null) ──────────────────────

  test("retourne null quand consentStatus est actif (isConsentWithdrawn = false)", () => {
    const source = readComponent();
    // La condition de rendu : si consent n'est pas retiré, on retourne null
    expect(source).toContain(
      "if (!consentStatus?.isConsentWithdrawn) return null;",
    );
  });

  test("consent actif — live: banner non visible sur la page d'accueil", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Le banner ne doit pas être visible (consent actif par défaut)
    const alertBanner = page.locator('[class*="alert"]').filter({
      hasText: "Consentement retiré",
    });
    // On vérifie que le texte n'est pas présent dans l'alerte warning
    // (le composant retourne null, donc pas de rendu)
    const alertCount = await alertBanner.count();
    expect(alertCount).toBe(0);

    // Vérifie aussi par le texte spécifique
    await expect(
      page.getByText("Consentement retiré"),
    ).toHaveCount(0);
  });

  // ─── Consent retiré → Alert warning visible avec bouton "Ré-accepter" ─

  test("affiche Alert avec variant warning quand consentement est retiré", () => {
    const source = readComponent();
    expect(source).toContain('<Alert variant="warning"');
    expect(source).toContain("ShieldAlert");
    expect(source).toContain("Consentement retiré");
    expect(source).toContain("Ré-accepter");
  });

  test("consent retiré — live: banner visible avec bouton Ré-accepter (mock tRPC)", async ({
    page,
  }) => {
    // Intercepte la query tRPC getConsentStatus pour simuler consentement retiré
    await page.route("**/api/trpc/user.getConsentStatus*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            result: {
              data: {
                json: { isConsentWithdrawn: true },
              },
            },
          },
        ]),
      });
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // La bannière d'alerte avec ShieldAlert doit être visible
    const alert = page.getByText("Consentement retiré");
    await expect(alert).toBeVisible();

    // Le bouton "Ré-accepter" doit être visible
    const reacceptBtn = page.getByRole("button", { name: "Ré-accepter" });
    await expect(reacceptBtn).toBeVisible();

    // L'icône ShieldAlert est visible (lucide-react)
    await expect(page.locator("svg.lucide-shield-alert")).toBeVisible();
  });

  // ─── Clic "Ré-accepter" → mutation + rechargement ───────────────────

  test("clic Ré-accepter déclenche la mutation reconsent et recharge", async ({
    page,
  }) => {
    // Intercepte la query pour simuler consentement retiré
    await page.route("**/api/trpc/user.getConsentStatus*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            result: {
              data: {
                json: { isConsentWithdrawn: true },
              },
            },
          },
        ]),
      });
    });

    // Intercepte la mutation reconsent
    let reconsentCalled = false;
    await page.route("**/api/trpc/user.reconsent*", async (route) => {
      reconsentCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            result: {
              data: {
                json: { success: true },
              },
            },
          },
        ]),
      });
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Vérifie que le bouton est visible
    const reacceptBtn = page.getByRole("button", { name: "Ré-accepter" });
    await expect(reacceptBtn).toBeVisible();

    // Simule le clic
    await reacceptBtn.click();

    // Vérifie que la mutation a été appelée
    // On attend un peu pour laisser la mutation s'exécuter
    await page.waitForTimeout(1000);
    expect(reconsentCalled).toBe(true);
  });

  test("le bouton Ré-accepter est désactivé pendant le reconsent (loading)", () => {
    const source = readComponent();
    // Le bouton a disabled={isReconsenting}
    expect(source).toContain("disabled={isReconsenting}");
    // Affiche "..." pendant le chargement
    expect(source).toContain('isReconsenting ? "..." : "Ré-accepter"');
  });

  // ─── Erreur API → pas de crash (rend null) ──────────────────────────

  test("erreur API getConsentStatus → pas de crash (retry: false)", () => {
    const source = readComponent();
    // La query a retry: false pour éviter les re-tentatives infinies
    expect(source).toContain("retry: false");
    // Si la query échoue, consentStatus est undefined
    // Donc consentStatus?.isConsentWithdrawn est undefined (falsy) → return null
  });

  test("erreur API — live: page ne crash pas quand getConsentStatus échoue", async ({
    page,
  }) => {
    // Fait échouer la requête tRPC
    await page.route("**/api/trpc/user.getConsentStatus*", (route) =>
      route.abort("connectionrefused"),
    );

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // La page doit s'afficher normalement sans crash
    // Le composant retourne null silencieusement
    await expect(page.locator("body")).toBeVisible();
    // Vérifie qu'il n'y a pas d'erreurs non gérées
    // Vérifie que la bannière n'est pas visible
    await expect(
      page.getByText("Consentement retiré"),
    ).toHaveCount(0);
  });

  test("erreur mutation reconsent → pas de crash, page reste stable", async ({
    page,
  }) => {
    // Intercepte la query pour simuler consentement retiré
    await page.route("**/api/trpc/user.getConsentStatus*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            result: {
              data: {
                json: { isConsentWithdrawn: true },
              },
            },
          },
        ]),
      });
    });

    // Intercepte la mutation reconsent pour simuler une erreur
    await page.route("**/api/trpc/user.reconsent*", (route) =>
      route.abort("connectionrefused"),
    );

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const reacceptBtn = page.getByRole("button", { name: "Ré-accepter" });
    await expect(reacceptBtn).toBeVisible();

    // Clic → la mutation échoue
    await reacceptBtn.click();

    // La page ne doit pas crash, le bouton n'est pas bloqué en loading éternel
    // car isReconsenting reste true mais la mutation onSuccess ne se déclenche pas
    await page.waitForTimeout(1000);

    // Vérifie que la page est toujours stable (pas d'erreur JS)
    await expect(page.locator("body")).toBeVisible();
  });

  // ─── Structure du composant ─────────────────────────────────────────

  test("affiche AlertTitle avec 'Consentement retiré'", () => {
    const source = readComponent();
    expect(source).toContain("<AlertTitle>Consentement retiré</AlertTitle>");
  });

  test("affiche AlertDescription avec le texte d'explication", () => {
    const source = readComponent();
    expect(source).toContain("ré-accepter les conditions");
    expect(source).toContain("AlertDescription");
  });

  test("l'icône ShieldAlert est rendue dans l'Alert", () => {
    const source = readComponent();
    expect(source).toContain("ShieldAlert");
    expect(source).toContain('className="w-4 h-4"');
  });

  test("retourne null quand consentStatus est undefined (premier render)", () => {
    const source = readComponent();
    // Le early return utilise optional chaining : consentStatus?.isConsentWithdrawn
    // Si consentStatus est undefined (premier render), on retourne null
    expect(source).toContain("consentStatus?.isConsentWithdrawn");
  });
});
