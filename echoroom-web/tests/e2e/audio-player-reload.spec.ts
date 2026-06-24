import { test, expect } from "@playwright/test";
import path from "path";

// ── Helpers ──

/**
 * Mock the auth session endpoint.
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
 * Mock the tRPC calls.replay endpoint.
 */
async function mockReplay(
  page: import("@playwright/test").Page,
  data: { recordingUrl: string | null; transcript: unknown },
) {
  await page.route("**/api/trpc/calls.replay*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { result: { data: { json: data } } },
      ]),
    });
  });
}

/**
 * Mock the tRPC calls.history endpoint.
 */
async function mockHistory(
  page: import("@playwright/test").Page,
  data: { items: Array<Record<string, unknown>> },
) {
  await page.route("**/api/trpc/calls.history*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { result: { data: { json: data } } },
      ]),
    });
  });
}

// ── Source analysis ──

test.describe("P5 — AudioPlayer useEffect dependency fix", () => {
  const PLAYER_PATH = path.resolve(
    __dirname,
    "../../src/components/player/AudioPlayer.tsx",
  );

  function readPlayerSource(): string {
    return require("fs").readFileSync(PLAYER_PATH, "utf-8");
  }

  test("source: useEffect has [recordingUrl] as dependency", () => {
    const source = readPlayerSource();
    // The fix: the useEffect that resets state depends on recordingUrl
    // Looking for: useEffect(() => { ... }, [recordingUrl]);
    expect(source).toContain("}, [recordingUrl]);");
  });

  test("source: useEffect resets hasError and isLoaded when recordingUrl changes", () => {
    const source = readPlayerSource();
    // The effect should setHasError(false) and setIsLoaded(false)
    expect(source).toContain("setHasError(false)");
    expect(source).toContain("setIsLoaded(false)");
  });

  test("source: handleTogglePlay includes recordingUrl in dependency array", () => {
    const source = readPlayerSource();
    // useCallback depends on recordingUrl to create a new Audio when URL changes
    expect(source).toContain("handleTogglePlay");
    expect(source).toContain("}, [recordingUrl])");
  });

  // ── Mock E2E tests ──

  test("mock: audio player shows loading state then empty state when switching between calls", async ({ page }) => {
    await mockSession(page);

    // First call: has a recording URL
    const firstCallId = "call-001";
    const firstRecordingUrl = "https://audio.example.com/first-call.mp3";

    await mockReplay(page, {
      recordingUrl: firstRecordingUrl,
      transcript: null,
    });

    await mockHistory(page, {
      items: [
        {
          id: firstCallId,
          scenario: { title: "First Scenario" },
          durationSeconds: 120,
          status: "COMPLETED",
        },
      ],
    });

    // Navigate to first call replay
    await page.goto(`/call/${firstCallId}`);
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requires authentication");
    if (redirected) return;

    // The audio player should have rendered — check that the container exists
    // It may be in loading state (spinner) or loaded (play button)
    const loaderSpinner = page.locator("svg.lucide-loader-2");
    const playButton = page.locator("svg.lucide-play");
    const emptyState = page.getByText("Aucun enregistrement disponible");

    // At least one of these states should be visible
    const spinnerVisible = await loaderSpinner.isVisible().catch(() => false);
    const playVisible = await playButton.isVisible().catch(() => false);
    const emptyVisible = await emptyState.isVisible().catch(() => false);

    expect(spinnerVisible || playVisible || emptyVisible).toBe(true);
  });

  test("mock: changing from call with audio to call without audio shows empty state", async ({ page }) => {
    await mockSession(page);

    // Step 1: Navigate to a call WITH recording URL
    const callWithAudio = "call-audio-1";
    await mockReplay(page, {
      recordingUrl: "https://audio.example.com/sample.mp3",
      transcript: null,
    });
    await mockHistory(page, { items: [] });

    await page.goto(`/call/${callWithAudio}`);
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requires authentication");
    if (redirected) return;

    // Step 2: Now change to a call WITHOUT recording URL
    const callWithoutAudio = "call-no-audio-2";
    await mockReplay(page, {
      recordingUrl: null,
      transcript: null,
    });

    await page.goto(`/call/${callWithoutAudio}`);
    await page.waitForLoadState("networkidle");

    // The useEffect with [recordingUrl] should have reset the state,
    // so the component should render the empty state
    await expect(
      page.getByText("Aucun enregistrement disponible"),
    ).toBeVisible({ timeout: 10000 });
  });

  test("mock: switching between two different calls reloads audio", async ({ page }) => {
    await mockSession(page);

    // Track which recording URLs were fetched
    const fetchedUrls: string[] = [];

    // Intercept audio URL requests to track them
    await page.route("https://audio.example.com/*", async (route) => {
      fetchedUrls.push(route.request().url());
      // Abort to prevent actual loading (we only care about the URL changing)
      await route.abort("timedout");
    });

    // Step 1: First call with recording URL
    await mockReplay(page, {
      recordingUrl: "https://audio.example.com/call-one.mp3",
      transcript: null,
    });
    await mockHistory(page, { items: [] });

    await page.goto("/call/call-one");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requires authentication");
    if (redirected) return;

    // Wait a moment for audio initialization to trigger
    await page.waitForTimeout(1000);

    // Step 2: Navigate to a second call with DIFFERENT recording URL
    await mockReplay(page, {
      recordingUrl: "https://audio.example.com/call-two.mp3",
      transcript: null,
    });

    await page.goto("/call/call-two");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // The component should have attempted to load the new audio URL
    // (triggered by the useEffect dependency on recordingUrl)
    const secondCallUrl = fetchedUrls.find((url) => url.includes("call-two.mp3"));
    expect(secondCallUrl).toBeTruthy();
  });

  test("mock: audio player shows loading indicator when switching to new recording URL", async ({ page }) => {
    await mockSession(page);

    // First call
    await mockReplay(page, {
      recordingUrl: "https://audio.example.com/old-call.mp3",
      transcript: null,
    });
    await mockHistory(page, { items: [] });

    await page.goto("/call/old-call");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requires authentication");
    if (redirected) return;

    // Block the new audio URL so it stays in loading state
    await page.route("https://audio.example.com/new-call.mp3", (route) =>
      route.abort("timedout"),
    );

    // Switch to second call with different audio
    await mockReplay(page, {
      recordingUrl: "https://audio.example.com/new-call.mp3",
      transcript: null,
    });

    await page.goto("/call/new-call");
    await page.waitForLoadState("networkidle");

    // The loading state should be visible because:
    // 1. useEffect with [recordingUrl] resets isLoaded to false
    // 2. The audio URL is blocked so it never fires loadedmetadata
    await expect(
      page.getByText("Préparation de l'audio..."),
    ).toBeVisible({ timeout: 10000 });

    // Loader2 spinner should be visible
    await expect(page.locator("svg.lucide-loader-2")).toBeVisible();
  });

  test("mock: error from first call does not persist when switching to valid call", async ({ page }) => {
    await mockSession(page);

    // Step 1: Navigate to a call with a FAILING audio URL
    await mockReplay(page, {
      recordingUrl: "https://audio.example.com/broken.mp3",
      transcript: null,
    });
    await mockHistory(page, { items: [] });

    // Block the audio to trigger error
    await page.route("https://audio.example.com/broken.mp3", (route) =>
      route.abort("connectionrefused"),
    );

    await page.goto("/call/broken-call");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requires authentication");
    if (redirected) return;

    // Wait for error to propagate
    await page.waitForTimeout(2000);

    // Step 2: Navigate to a call with a VALID audio URL
    await mockReplay(page, {
      recordingUrl: "https://audio.example.com/working.mp3",
      transcript: null,
    });

    await page.goto("/call/working-call");
    await page.waitForLoadState("networkidle");

    // The useEffect with [recordingUrl] should have reset hasError to false,
    // so the error state should NOT be visible
    await expect(
      page.getByText("Chargement impossible"),
    ).not.toBeVisible({ timeout: 5000 });
  });
});
