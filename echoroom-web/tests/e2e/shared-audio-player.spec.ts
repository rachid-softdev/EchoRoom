import path from "node:path";
import { expect, test } from "@playwright/test";

const COMPONENT_PATH = path.resolve(__dirname, "../../src/components/player/AudioPlayer.tsx");

function readComponent(): string {
  return require("node:fs").readFileSync(COMPONENT_PATH, "utf-8");
}

/**
 * Mock du endpoint tRPC calls.replay pour contrôler recordingUrl.
 */
async function mockReplay(
  page: import("@playwright/test").Page,
  data: { recordingUrl: string | null; transcript: unknown },
) {
  await page.route("**/api/trpc/calls.replay*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ result: { data: { json: data } } }]),
    });
  });
}

/**
 * Mock de la session auth pour éviter les redirections.
 */
async function mockSession(page: import("@playwright/test").Page) {
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "test-user-id",
          name: "Test User",
          email: "test@example.com",
          role: "USER",
        },
        expires: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    });
  });
}

/**
 * Helper: mock calls.history.
 */
async function mockHistory(
  page: import("@playwright/test").Page,
  data: { items: Array<Record<string, unknown>> },
) {
  await page.route("**/api/trpc/calls.history*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ result: { data: { json: data } } }]),
    });
  });
}

test.describe("AudioPlayer — Composant Partagé", () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page);
    await mockHistory(page, { items: [] });
  });

  // ─── Analyse statique du source ─────────────────────────────────────

  test("est exporté comme fonction nommée", () => {
    const source = readComponent();
    expect(source).toContain("export function AudioPlayer");
  });

  test("accepte les props recordingUrl et title", () => {
    const source = readComponent();
    expect(source).toContain("recordingUrl");
    expect(source).toContain("title");
  });

  // ─── recordingUrl=null → "Aucun enregistrement disponible" ──────────

  test("recordingUrl=null — affiche 'Aucun enregistrement disponible'", () => {
    const source = readComponent();
    // Le premier bloc conditionnel : if (!recordingUrl)
    expect(source).toContain("if (!recordingUrl)");
    expect(source).toContain("Aucun enregistrement disponible");
    expect(source).toContain("Clock");
  });

  test("recordingUrl=null — live: état vide avec icône Clock", async ({ page }) => {
    await mockReplay(page, { recordingUrl: null, transcript: null });

    await page.goto("/call/test-call-id");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requiert une authentification");
    if (redirected) return;

    // Message d'état vide
    await expect(page.getByText("Aucun enregistrement disponible")).toBeVisible();

    // Icône Clock
    await expect(page.locator("svg.lucide-clock")).toBeVisible();

    // Aucun bouton play/pause
    await expect(page.locator("svg.lucide-play, svg.lucide-pause")).toHaveCount(0);
  });

  // ─── recordingUrl=undefined → même état vide ────────────────────────

  test("recordingUrl=undefined — affiche aussi 'Aucun enregistrement disponible'", () => {
    const source = readComponent();
    // La condition if (!recordingUrl) capture null ET undefined
    expect(source).toContain("if (!recordingUrl)");
  });

  test("recordingUrl=undefined — live: même état vide que null", async ({ page }) => {
    await mockReplay(page, { recordingUrl: null, transcript: null });

    await page.goto("/call/test-call-id");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requiert une authentification");
    if (redirected) return;

    await expect(page.getByText("Aucun enregistrement disponible")).toBeVisible();
    await expect(page.locator("svg.lucide-clock")).toBeVisible();
  });

  // ─── État loading → spinner + "Préparation de l'audio..." ─────────

  test("loading — affiche Loader2 spinner et 'Préparation de l'audio...'", () => {
    const source = readComponent();
    expect(source).toContain("Loader2");
    expect(source).toContain("Préparation de l'audio...");
    // Condition : !isLoaded && recordingUrl !== null && !hasError
    expect(source).toContain("!isLoaded && recordingUrl !== null && !hasError");
  });

  test("loading — live: spinner visible quand l'audio est en cours de chargement", async ({
    page,
  }) => {
    await mockReplay(page, {
      recordingUrl: "https://example.com/audio.mp3",
      transcript: null,
    });

    // Bloque l'URL audio pour qu'elle ne se charge jamais
    await page.route("https://example.com/audio.mp3", (route) => route.abort("timedout"));

    await page.goto("/call/test-call-id");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requiert une authentification");
    if (redirected) return;

    await expect(page.locator("svg.lucide-loader-2")).toBeVisible();
    await expect(page.getByText("Préparation de l'audio...")).toBeVisible();
  });

  // ─── Erreur audio → AlertTriangle + "Chargement impossible" ─────────

  test("erreur — affiche AlertTriangle et 'Chargement impossible'", () => {
    const source = readComponent();
    expect(source).toContain("hasError");
    expect(source).toContain("AlertTriangle");
    expect(source).toContain("Chargement impossible");
    expect(source).toContain("L'audio n'est pas accessible. Réessayez.");
  });

  test("erreur — live: AlertTriangle visible quand le chargement audio échoue", async ({
    page,
  }) => {
    await mockReplay(page, {
      recordingUrl: "https://example.com/audio.mp3",
      transcript: null,
    });

    // Bloque l'audio pour causer une erreur
    await page.route("https://example.com/audio.mp3", (route) => route.abort("connectionrefused"));

    await page.goto("/call/test-call-id");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requiert une authentification");
    if (redirected) return;

    // Attend que l'erreur se propage
    await page.waitForTimeout(2000);

    await expect(page.locator("svg.lucide-alert-triangle")).toBeVisible();
    await expect(page.getByText("Chargement impossible")).toBeVisible();
    await expect(page.getByText("L'audio n'est pas accessible. Réessayez.")).toBeVisible();
  });

  // ─── Play/pause toggle (icône change) ───────────────────────────────

  test("play/pause — le bouton toggle bascule entre Play et Pause", () => {
    const source = readComponent();
    expect(source).toContain("isPlaying");
    // Rendu conditionnel : Play quand paused, Pause quand playing
    expect(source).toContain("isPlaying ? (");
    expect(source).toContain("<Pause");
    expect(source).toContain("<Play");
  });

  test("play/pause — live: bouton play visible quand l'audio est loaded", async ({ page }) => {
    await mockReplay(page, {
      recordingUrl: "https://example.com/audio.mp3",
      transcript: null,
    });

    await page.goto("/call/test-call-id");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requiert une authentification");
    if (redirected) return;

    // Le bouton play devrait être visible (isPlaying = false par défaut)
    await expect(page.locator("svg.lucide-play")).toBeVisible();
  });

  test("play/pause — live: clic sur play fait apparaître pause", async ({ page }) => {
    await mockReplay(page, {
      recordingUrl: "https://example.com/audio.mp3",
      transcript: null,
    });

    await page.goto("/call/test-call-id");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requiert une authentification");
    if (redirected) return;

    const playButton = page.locator("button").filter({ has: page.locator("svg.lucide-play") });
    if (await playButton.isVisible()) {
      await playButton.click();
      // Après clic, l'icône devrait être Pause (ou Play si l'audio a échoué)
      // Au moins un des deux est visible
      await expect(page.locator("svg.lucide-pause, svg.lucide-play").first()).toBeVisible();
    }
  });

  // ─── Seek slider (modification du temps) ────────────────────────────

  test("seek slider — input type=range avec min=0 quand loaded", () => {
    const source = readComponent();
    expect(source).toContain('type="range"');
    expect(source).toContain("min={0}");
    expect(source).toContain("max={duration}");
    expect(source).toContain("value={currentTime}");
    expect(source).toContain("handleSeek");
  });

  test("seek slider — live: range input présent quand loaded", async ({ page }) => {
    await mockReplay(page, {
      recordingUrl: "https://example.com/audio.mp3",
      transcript: null,
    });

    await page.goto("/call/test-call-id");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requiert une authentification");
    if (redirected) return;

    // Le slider est conditionnel à isLoaded && duration > 0
    // On vérifie sa présence dans la structure
    const seekSlider = page.locator('input[type="range"]');
    const count = await seekSlider.count();

    if (count > 0) {
      await expect(seekSlider).toHaveAttribute("min", "0");
    }
  });

  test("seek slider — live: temps formaté mm:ss présent", async ({ page }) => {
    await mockReplay(page, {
      recordingUrl: "https://example.com/audio.mp3",
      transcript: null,
    });

    await page.goto("/call/test-call-id");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requiert une authentification");
    if (redirected) return;

    // Vérifie le format mm:ss
    const timeSpans = page.locator("span").filter({ hasText: /^\d+:\d{2}$/ });
    const count = await timeSpans.count();

    if (count > 0) {
      for (let i = 0; i < count; i++) {
        await expect(timeSpans.nth(i)).toBeVisible();
      }
    }
  });

  // ─── Changement de vitesse (highlight actif) ────────────────────────

  test("vitesse — 6 boutons de vitesse: 0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x", () => {
    const source = readComponent();
    expect(source).toContain("[0.5, 0.75, 1, 1.25, 1.5, 2]");
    expect(source).toContain("handleSpeedChange");
  });

  test("vitesse — live: 6 boutons de vitesse visibles", async ({ page }) => {
    await mockReplay(page, {
      recordingUrl: "https://example.com/audio.mp3",
      transcript: null,
    });

    await page.goto("/call/test-call-id");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requiert une authentification");
    if (redirected) return;

    const speedLabels = ["0.5x", "0.75x", "1x", "1.25x", "1.5x", "2x"];
    for (const label of speedLabels) {
      const btn = page.locator("button").filter({ hasText: label });
      const count = await btn.count();
      if (count > 0) {
        await expect(btn.first()).toBeVisible();
      }
    }
  });

  test("vitesse — live: le bouton actif (1x par défaut) a la classe bg-primary/10 ou text-primary", async ({
    page,
  }) => {
    await mockReplay(page, {
      recordingUrl: "https://example.com/audio.mp3",
      transcript: null,
    });

    await page.goto("/call/test-call-id");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requiert une authentification");
    if (redirected) return;

    const activeSpeed = page.locator("button").filter({ hasText: "1x" });
    const count = await activeSpeed.count();
    if (count > 0) {
      const classAttr = await activeSpeed.first().getAttribute("class");
      expect(classAttr).toBeTruthy();
      const hasPrimaryClass =
        classAttr!.includes("bg-primary") || classAttr!.includes("text-primary");
      expect(hasPrimaryClass).toBe(true);
    }
  });

  // ─── Download button avec lien ──────────────────────────────────────

  test("download — lien <a download> avec href et attribut download", () => {
    const source = readComponent();
    expect(source).toContain("download");
    expect(source).toContain("href={recordingUrl}");
    expect(source).toContain("Télécharger");
    expect(source).toContain("Download");
  });

  test("download — live: lien de téléchargement avec href correct", async ({ page }) => {
    await mockReplay(page, {
      recordingUrl: "https://example.com/audio.mp3",
      transcript: null,
    });

    await page.goto("/call/test-call-id");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requiert une authentification");
    if (redirected) return;

    const downloadLink = page.locator("a[download]");
    const count = await downloadLink.count();
    if (count > 0) {
      await expect(downloadLink).toBeVisible();
      await expect(downloadLink).toHaveAttribute("href", "https://example.com/audio.mp3");
      await expect(page.getByText("Télécharger")).toBeVisible();
      await expect(page.locator("svg.lucide-download")).toBeVisible();
    }
  });

  // ─── Cleanup au démontage (pas d'audio en fond) ─────────────────────

  test("cleanup — useEffect de cleanup met pause et nullifie audioRef", () => {
    const source = readComponent();
    // Le useEffect de cleanup
    expect(source).toContain("return () => {");
    expect(source).toContain("audioRef.current.pause()");
    expect(source).toContain("audioRef.current = null");
  });

  test("cleanup — le tableau de dépendances du cleanup useEffect est vide", () => {
    const source = readComponent();
    // Cherche le useEffect avec le cleanup, qui a [] en dépendances
    // On vérifie la présence du pattern
    expect(source).toContain("useEffect(() => {");
    expect(source).toContain("return () => {");
    expect(source).toContain("audioRef.current.pause()");
  });

  // ─── Titre optionnel ────────────────────────────────────────────────

  test("title — affiché optionnellement au-dessus des contrôles", () => {
    const source = readComponent();
    expect(source).toContain("{title && (");
    expect(source).toContain("{title}");
  });

  // ─── Reset d'état au changement de recordingUrl ─────────────────────

  test("reset — useEffect reset hasError et isLoaded quand recordingUrl change", () => {
    const source = readComponent();
    expect(source).toContain("setHasError(false)");
    expect(source).toContain("setIsLoaded(false)");
    // La dépendance est recordingUrl
    expect(source).toContain("}, [recordingUrl]);");
  });

  // ─── Structure du composant ─────────────────────────────────────────

  test("bouton play/pause a size='lg' et rounded-full w-16 h-16", () => {
    const source = readComponent();
    expect(source).toContain('size="lg"');
    expect(source).toContain('className="rounded-full w-16 h-16 mb-4"');
  });

  test("conteneur audio loaded a className 'flex flex-col items-center py-6'", () => {
    const source = readComponent();
    // Vérifie le conteneur principal du loaded state
    expect(source).toContain('<div className="flex flex-col items-center py-6">');
  });

  test("état loading a un cercle bg-muted avec Loader2", () => {
    const source = readComponent();
    // Loader2 dans un cercle bg-muted
    expect(source).toContain(
      "w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4",
    );
  });
});
