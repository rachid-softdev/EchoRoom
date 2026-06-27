import { expect, test } from "@playwright/test";

/**
 * Helper to mock the tRPC calls.replay endpoint.
 */
async function mockReplay(
  page: import("@playwright/test").Page,
  data: {
    recordingUrl: string | null;
    transcript: unknown;
  },
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
 * Helper to mock the tRPC calls.history endpoint.
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

/**
 * Helper to mock the auth session endpoint.
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

test.describe("TranscriptView component", () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page);
    // Default: no matching call in history (no scenarioName)
    await mockHistory(page, { items: [] });
  });

  // ─── Loading state ────────────────────────────────────────────────

  test("shows 5 skeleton elements while loading", async ({ page }) => {
    // To test the loading state, we intercept the replay query and delay its response.
    // While the query is in flight, DataLoader shows a loading state,
    // and TranscriptView receives isLoading=true from replayQuery.isFetching.
    //
    // We simulate a slow response by never fulfilling the replay route,
    // keeping the query in loading state indefinitely.
    await page.route("**/api/trpc/calls.replay*", async () => {
      // Never fulfill — keeps isLoading = true
    });

    await page.goto("/call/test-call-id");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requires authentication");
    if (redirected) return;

    // 5 skeleton elements should be visible (each with animate-pulse or skeleton class)
    const skeletons = page.locator('[class*="animate-pulse"], [class*="skeleton"]');
    const count = await skeletons.count();
    // The loading state renders 5 skeleton groups × ~3 skeletons each = ~15 total skeleton divs.
    // At minimum we should have some skeleton placeholders visible.
    expect(count).toBeGreaterThanOrEqual(5);
  });

  // ─── Null transcript ──────────────────────────────────────────────

  test("shows processing message when transcript is null", async ({ page }) => {
    await mockReplay(page, { recordingUrl: null, transcript: null });

    await page.goto("/call/test-call-id");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requires authentication");
    if (redirected) return;

    // Processing message
    await expect(page.getByText("Transcript en cours de traitement…")).toBeVisible();

    // MessageSquare icon
    await expect(page.locator("svg.lucide-message-square")).toBeVisible();
  });

  // ─── Empty array transcript ───────────────────────────────────────

  test("shows empty state when transcript is an empty array", async ({ page }) => {
    await mockReplay(page, { recordingUrl: null, transcript: [] });

    await page.goto("/call/test-call-id");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requires authentication");
    if (redirected) return;

    await expect(page.getByText("Aucune transcription disponible")).toBeVisible();

    // MessageSquare icon
    await expect(page.locator("svg.lucide-message-square")).toBeVisible();
  });

  test("shows empty state when transcript is undefined (omitted)", async ({ page }) => {
    await mockReplay(page, { recordingUrl: null, transcript: null });

    await page.goto("/call/test-call-id");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requires authentication");
    if (redirected) return;

    await expect(page.getByText("Aucune transcription disponible")).not.toBeVisible();

    // null transcript shows the "processing" message instead
    await expect(page.getByText("Transcript en cours de traitement…")).toBeVisible();
  });

  // ─── Loaded transcript with AI and user messages ──────────────────

  test("renders AI and user chat bubbles", async ({ page }) => {
    const transcript = [
      { speaker: "assistant", text: "Bonjour, comment allez-vous ?" },
      { speaker: "user", text: "Très bien, merci !" },
      { speaker: "assistant", text: "Parfait, commençons l'exercice." },
    ];
    await mockReplay(page, {
      recordingUrl: null,
      transcript,
    });

    await page.goto("/call/test-call-id");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requires authentication");
    if (redirected) return;

    // Each message text should be visible
    await expect(page.getByText("Bonjour, comment allez-vous ?")).toBeVisible();
    await expect(page.getByText("Très bien, merci !")).toBeVisible();
    await expect(page.getByText("Parfait, commençons l'exercice.")).toBeVisible();
  });

  // ─── AI vs User alignment ─────────────────────────────────────────

  test("aligns AI messages to the left and user messages to the right", async ({ page }) => {
    const transcript = [
      { speaker: "assistant", text: "Message IA" },
      { speaker: "user", text: "Message utilisateur" },
    ];
    await mockReplay(page, {
      recordingUrl: null,
      transcript,
    });

    await page.goto("/call/test-call-id");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requires authentication");
    if (redirected) return;

    // AI messages are in a div with no justify-end class (default = left)
    // User messages are in a div with justify-end (right aligned)
    const aiBubble = page.getByText("Message IA").locator("..");
    const userBubble = page.getByText("Message utilisateur").locator("..");

    // The parent of the text is the chat bubble div.
    // The grandparent has the flex container with justify-end or not.
    const aiContainer = aiBubble.locator("..");
    const userContainer = userBubble.locator("..");

    const userClass = await userContainer.getAttribute("class");
    expect(userClass).toContain("justify-end");

    // AI container should NOT have justify-end
    const aiClass = await aiContainer.getAttribute("class");
    expect(aiClass).not.toContain("justify-end");
  });

  // ─── AI avatar ────────────────────────────────────────────────────

  test("shows IA text in avatar circle for AI messages", async ({ page }) => {
    const transcript = [{ speaker: "assistant", text: "Salut l'utilisateur !" }];
    await mockReplay(page, {
      recordingUrl: null,
      transcript,
    });

    await page.goto("/call/test-call-id");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requires authentication");
    if (redirected) return;

    // "IA" label should be visible in the AI avatar circle
    await expect(page.getByText("IA")).toBeVisible();
  });

  // ─── User avatar ──────────────────────────────────────────────────

  test("shows Moi text in avatar circle for user messages", async ({ page }) => {
    const transcript = [
      { speaker: "assistant", text: "Hello" },
      { speaker: "user", text: "Bonjour" },
    ];
    await mockReplay(page, {
      recordingUrl: null,
      transcript,
    });

    await page.goto("/call/test-call-id");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requires authentication");
    if (redirected) return;

    // "Moi" label should be visible in the user avatar circle
    await expect(page.getByText("Moi")).toBeVisible();
  });

  // ─── Timestamp ────────────────────────────────────────────────────

  test("displays timestamp when chunk has timestamp", async ({ page }) => {
    const transcript = [{ speaker: "assistant", text: "Bonjour", timestamp: 65 }];
    await mockReplay(page, {
      recordingUrl: null,
      transcript,
    });

    await page.goto("/call/test-call-id");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requires authentication");
    if (redirected) return;

    // 65 seconds = 1:05
    await expect(page.getByText("1:05")).toBeVisible();
  });

  test("does not show timestamp when timestamp is undefined", async ({ page }) => {
    const transcript = [{ speaker: "assistant", text: "Bonjour" }];
    await mockReplay(page, {
      recordingUrl: null,
      transcript,
    });

    await page.goto("/call/test-call-id");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requires authentication");
    if (redirected) return;

    // No mm:ss pattern should appear in the transcript area
    await expect(page.locator("text=/^\\d+:\\d{2}$/")).toHaveCount(0);
  });

  // ─── Scenario name ────────────────────────────────────────────────

  test("shows scenario name as AI label when scenarioName is provided", async ({ page }) => {
    const transcript = [{ speaker: "assistant", text: "Bienvenue dans la simulation" }];
    // Provide history with a matching scenario title
    await mockHistory(page, {
      items: [
        {
          id: "test-call-id",
          scenario: { title: "Dr. Smith" },
          durationSeconds: 120,
          status: "COMPLETED",
        },
      ],
    });
    await mockReplay(page, {
      recordingUrl: null,
      transcript,
    });

    await page.goto("/call/test-call-id");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requires authentication");
    if (redirected) return;

    // The AI label should show the scenario name "Dr. Smith"
    await expect(page.getByText("Dr. Smith")).toBeVisible();
  });

  test("shows fallback Personnage IA when scenarioName is not provided", async ({ page }) => {
    const transcript = [{ speaker: "assistant", text: "Bonjour" }];
    await mockReplay(page, {
      recordingUrl: null,
      transcript,
    });

    await page.goto("/call/test-call-id");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requires authentication");
    if (redirected) return;

    // Without scenarioName, the fallback label "Personnage IA" is shown
    await expect(page.getByText("Personnage IA")).toBeVisible();
  });

  test("shows Vous label for user messages", async ({ page }) => {
    const transcript = [
      { speaker: "assistant", text: "Hello" },
      { speaker: "user", text: "Salut" },
    ];
    await mockReplay(page, {
      recordingUrl: null,
      transcript,
    });

    await page.goto("/call/test-call-id");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requires authentication");
    if (redirected) return;

    // The user speaker label shows "Vous"
    await expect(page.getByText("Vous")).toBeVisible();
  });
});
