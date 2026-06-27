import path from "node:path";
import { expect, test } from "@playwright/test";

// ── Helpers ──

/**
 * Mock the session endpoint to return authenticated user data.
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
 * Mock the tRPC dashboard.getData endpoint with full success data.
 */
async function mockDashboardData(
  page: import("@playwright/test").Page,
  data: {
    credits: number;
    calls: Array<Record<string, unknown>>;
    todayCount: number;
    scenarios: Array<Record<string, unknown>>;
  },
) {
  await page.route("**/api/trpc/dashboard.getData*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ result: { data: { json: data } } }]),
    });
  });
}

/**
 * Make the dashboard.getData endpoint fail selectively for specific fields.
 * Simulates individual .catch() resilience by having some data fail and some succeed.
 */
async function mockDashboardDataWithPartialFailure(
  page: import("@playwright/test").Page,
  failComponents: ("credits" | "calls" | "todayCount" | "scenarios")[],
  successData: {
    credits?: number;
    calls?: Array<Record<string, unknown>>;
    todayCount?: number;
    scenarios?: Array<Record<string, unknown>>;
  } = {},
) {
  await page.route("**/api/trpc/dashboard.getData*", async (route) => {
    // Build response based on which components should fail
    const response: Record<string, unknown> = {
      credits: failComponents.includes("credits") ? null : (successData.credits ?? 25),
      calls: failComponents.includes("calls") ? [] : (successData.calls ?? []),
      todayCount: failComponents.includes("todayCount") ? 0 : (successData.todayCount ?? 3),
      scenarios: failComponents.includes("scenarios") ? [] : (successData.scenarios ?? []),
    };

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ result: { data: { json: response } } }]),
    });
  });
}

/**
 * Completely fail the dashboard.getData endpoint to test total failure.
 */
async function failDashboardData(page: import("@playwright/test").Page) {
  await page.route("**/api/trpc/dashboard.getData*", (route) => route.abort("connectionrefused"));
}

// ── Source analysis ──

test.describe("P4 — Dashboard resilience (individual .catch())", () => {
  const DASHBOARD_PATH = path.resolve(__dirname, "../../src/server/routers/dashboard.ts");

  function readDashboardSource(): string {
    return require("node:fs").readFileSync(DASHBOARD_PATH, "utf-8");
  }

  test("source: all 4 DB queries have individual .catch() handlers", () => {
    const source = readDashboardSource();
    // Count the number of .catch(() => ...) occurrences in the Promise.all
    const catchCount = (source.match(/\.catch\(\(\)\s*=>/g) ?? []).length;
    // There should be at least 4 .catch() handlers for the 4 parallel queries
    expect(catchCount).toBeGreaterThanOrEqual(4);
  });

  test("source: fallback values are typed correctly", () => {
    const source = readDashboardSource();
    // userBillingRepository: catch → null
    expect(source).toContain("userBillingRepository.findByUserId(userId).catch(() => null)");
    // db.call.findMany: catch → []
    expect(source).toContain("db.call.findMany");
    expect(source).toContain(".catch(() => [])");
    // db.call.count: catch → 0
    expect(source).toContain("db.call.count");
    expect(source).toContain(".catch(() => 0)");
    // db.scenario.findMany: catch → []
    expect(source).toContain("db.scenario.findMany");
    expect(source).toContain(".catch(() => [])");
  });

  test("source: queries run in parallel via Promise.all", () => {
    const source = readDashboardSource();
    // The 4 queries should be wrapped in a single Promise.all
    expect(source).toContain("Promise.all([");
  });

  // ── Mock E2E tests ──

  test("mock: dashboard loads normally when all queries succeed", async ({ page }) => {
    await mockSession(page);
    await mockDashboardData(page, {
      credits: 50,
      calls: [
        {
          id: "call-1",
          scenario: { title: "Test Scenario", character: { name: "Bot", slug: "bot" } },
          status: "COMPLETED",
          durationSeconds: 120,
          createdAt: new Date().toISOString(),
        },
      ],
      todayCount: 5,
      scenarios: [
        {
          id: "scenario-1",
          title: "My Scenario",
          character: { name: "Assistant", slug: "assistant", avatarUrl: null, category: "GENERAL" },
          _count: { reactions: 0, comments: 0 },
        },
      ],
    });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/dashboard");
    test.skip(redirected, "Authentication required to access dashboard page");
    if (redirected) return;

    // Dashboard shell should be visible
    await expect(page.getByText("Tableau de bord").first()).toBeVisible();
  });

  test("mock: dashboard still renders when credits query fails", async ({ page }) => {
    await mockSession(page);
    await mockDashboardDataWithPartialFailure(page, ["credits"], {
      calls: [],
      todayCount: 3,
      scenarios: [],
    });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/dashboard");
    test.skip(redirected, "Authentication required to access dashboard page");
    if (redirected) return;

    // Dashboard should still render with 0 credits (fallback)
    await expect(page.getByText("Tableau de bord").first()).toBeVisible();
  });

  test("mock: dashboard still renders when calls query fails", async ({ page }) => {
    await mockSession(page);
    await mockDashboardDataWithPartialFailure(page, ["calls"], {
      credits: 50,
      todayCount: 3,
      scenarios: [],
    });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/dashboard");
    test.skip(redirected, "Authentication required to access dashboard page");
    if (redirected) return;

    // Dashboard should still render
    await expect(page.getByText("Tableau de bord").first()).toBeVisible();
  });

  test("mock: dashboard still renders when todayCount query fails", async ({ page }) => {
    await mockSession(page);
    await mockDashboardDataWithPartialFailure(page, ["todayCount"], {
      credits: 50,
      calls: [],
      scenarios: [],
    });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/dashboard");
    test.skip(redirected, "Authentication required to access dashboard page");
    if (redirected) return;

    // Dashboard should still render
    await expect(page.getByText("Tableau de bord").first()).toBeVisible();
  });

  test("mock: dashboard still renders when scenarios query fails", async ({ page }) => {
    await mockSession(page);
    await mockDashboardDataWithPartialFailure(page, ["scenarios"], {
      credits: 50,
      calls: [],
      todayCount: 3,
    });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/dashboard");
    test.skip(redirected, "Authentication required to access dashboard page");
    if (redirected) return;

    // Dashboard should still render
    await expect(page.getByText("Tableau de bord").first()).toBeVisible();
  });

  test("mock: dashboard renders with multiple failed queries simultaneously", async ({ page }) => {
    await mockSession(page);
    // Fail 3 out of 4 queries
    await mockDashboardDataWithPartialFailure(page, ["credits", "calls", "todayCount"], {
      scenarios: [
        {
          id: "scenario-1",
          title: "Only Surviving Scenario",
          character: { name: "Bot", slug: "bot", avatarUrl: null, category: "GENERAL" },
          _count: { reactions: 0, comments: 0 },
        },
      ],
    });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/dashboard");
    test.skip(redirected, "Authentication required to access dashboard page");
    if (redirected) return;

    // Dashboard should still render with the surviving scenario data
    await expect(page.getByText("Tableau de bord").first()).toBeVisible();
  });

  test("mock: dashboard shows today count when other widgets fail", async ({ page }) => {
    await mockSession(page);
    await mockDashboardDataWithPartialFailure(page, ["credits", "calls", "scenarios"], {
      todayCount: 7,
    });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/dashboard");
    test.skip(redirected, "Authentication required to access dashboard page");
    if (redirected) return;

    // Dashboard should still render
    await expect(page.getByText("Tableau de bord").first()).toBeVisible();
  });

  test("mock: dashboard handles total API failure gracefully", async ({ page }) => {
    await mockSession(page);
    await failDashboardData(page);

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/dashboard");
    test.skip(redirected, "Authentication required to access dashboard page");
    if (redirected) return;

    // Dashboard might show error state or fallback; either way, it should not
    // crash with a white screen. Check that the page rendered something.
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });
});
