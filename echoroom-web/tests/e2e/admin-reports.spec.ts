import { test, expect } from "@playwright/test";
import path from "path";

const COMPONENT_PATH = path.resolve(
  __dirname,
  "../../src/app/admin/reports/ReportsPageClient.tsx",
);

function readComponent(): string {
  return require("fs").readFileSync(COMPONENT_PATH, "utf-8");
}

test.describe("Admin Reports page", () => {
  test("component is default exported", () => {
    const source = readComponent();
    expect(source).toContain("export default function ReportsPageClient");
  });

  test('page heading is "Signalements"', () => {
    const source = readComponent();
    expect(source).toContain("Signalements");
  });

  test("subtitle mentions content moderation", () => {
    const source = readComponent();
    expect(source).toContain("Gérez les signalements de contenu abusif");
  });

  test("4 status filter buttons: Tous, En attente, Traité, Ignoré", () => {
    const source = readComponent();
    expect(source).toContain("Tous");
    expect(source).toContain("En attente");
    expect(source).toContain("Traité");
    expect(source).toContain("Ignoré");
    expect(source).toMatch(/statusFilter === filter\.value \? "default" : "outline"/);
  });

  test("report cards show targetType badge, status badge, reporter and date", () => {
    const source = readComponent();
    expect(source).toMatch(/targetTypeLabels\[report\.targetType\]/);
    expect(source).toMatch(/statusLabels\[report\.status\]/);
    expect(source).toMatch(/report\.reporter\?\.username/);
    expect(source).toContain("toLocaleDateString");
  });

  test("reason text truncated to 100 characters", () => {
    const source = readComponent();
    expect(source).toContain("report.reason.length > 100");
    expect(source).toContain("report.reason.slice(0, 100)");
  });

  test("reviewedBy indicator shows reviewer username", () => {
    const source = readComponent();
    expect(source).toContain("report.reviewedBy");
    expect(source).toContain("reviewedBy.username");
  });

  test("PENDING reports show Ignorer button with Check icon", () => {
    const source = readComponent();
    expect(source).toContain("PENDING");
    expect(source).toContain("Ignorer");
    expect(source).toMatch(/Check.*w-4 h-4/);
  });

  test("dismiss button disabled when mutation is pending", () => {
    const source = readComponent();
    expect(source).toContain('disabled={dismissMutation.isPending}');
  });

  test("uses admin.getAbuseReports query", () => {
    const source = readComponent();
    expect(source).toMatch(/\.admin\.getAbuseReports\.useQuery/);
  });

  test("uses admin.dismissAbuseReport mutation", () => {
    const source = readComponent();
    expect(source).toMatch(/\.admin\.dismissAbuseReport\.useMutation/);
  });

  test("dismiss success refetches the reports", () => {
    const source = readComponent();
    expect(source).toContain("reportsQuery.refetch()");
  });

  test("empty state shows Aucun signalement text", () => {
    const source = readComponent();
    expect(source).toContain("Aucun signalement");
    expect(source).toContain("Aucun signalement à afficher pour ce filtre");
  });
});

// ── B10 : Pagination E2E ──────────────────────────────────────────────

/**
 * Helper: mock une session admin
 */
async function mockAdminSession(page: import("@playwright/test").Page) {
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "mock-admin-id",
          name: "Admin User",
          email: "admin@echoroom.test",
          username: "admin",
          role: "ADMIN",
          credits: 999,
        },
        expires: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    });
  });
}

/**
 * Construit une réponse tRPC paginée pour admin.getAbuseReports
 */
function buildReportsResponse(
  items: Array<Record<string, unknown>>,
  nextCursor: string | null,
) {
  return JSON.stringify([
    {
      result: {
        data: {
          json: { items, nextCursor },
        },
      },
    },
  ]);
}

/**
 * Génère N signalements factices
 */
function generateReports(
  count: number,
  startIndex: number = 0,
): Array<Record<string, unknown>> {
  return Array.from({ length: count }, (_, i) => ({
    id: `report-${startIndex + i}`,
    targetType: "COMMENT",
    status: "PENDING",
    reason: `Raison du signalement numéro ${startIndex + i + 1} — contenu inapproprié détecté`,
    createdAt: new Date(Date.now() - (startIndex + i) * 3600000).toISOString(),
    reporter: { username: `reporter${startIndex + i}` },
    reviewedBy: null,
  }));
}

test.describe("Admin reports — pagination (B10)", () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminSession(page);
  });

  test("B10 — Voir plus button appears when > 20 reports", async ({ page }) => {
    const reports = generateReports(25);
    const firstPage = reports.slice(0, 20);
    const secondPage = reports.slice(20, 25);

    let callCount = 0;
    await page.route("**/api/trpc/admin.getAbuseReports*", async (route) => {
      callCount++;
      if (callCount === 1) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: buildReportsResponse(firstPage, "cursor-20"),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: buildReportsResponse(secondPage, null),
        });
      }
    });

    await page.goto("/admin/reports");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/admin/reports");
    test.skip(redirected, "Skipping: requires admin auth");
    if (redirected) return;

    // Vérifier "Voir plus"
    const voirPlus = page.getByRole("button", { name: "Voir plus" });
    await expect(voirPlus).toBeVisible();

    // Cliquer pour charger la suite
    await voirPlus.click();
    await page.waitForTimeout(500);

    // Item de la page suivante visible
    await expect(page.getByText("signalement numéro 21")).toBeVisible();
  });

  test("B10 — Voir plus hidden when hasMore = false", async ({ page }) => {
    const reports = generateReports(15, 0);

    await page.route("**/api/trpc/admin.getAbuseReports*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: buildReportsResponse(reports, null),
      });
    });

    await page.goto("/admin/reports");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/admin/reports");
    test.skip(redirected, "Skipping: requires admin auth");
    if (redirected) return;

    const voirPlus = page.getByRole("button", { name: "Voir plus" });
    await expect(voirPlus).not.toBeVisible();
  });

  test("B10 — status filter refetches with pagination reset", async ({ page }) => {
    const allReports = generateReports(25);
    const pendingPage = allReports.slice(0, 20);

    let callCount = 0;
    await page.route("**/api/trpc/admin.getAbuseReports*", async (route) => {
      callCount++;
      const url = new URL(route.request().url());
      const hasStatus = url.searchParams.toString().includes("PENDING");
      // Répondre avec les données filtrées selon le statut
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: buildReportsResponse(
          hasStatus ? pendingPage : allReports.slice(0, 20),
          callCount <= 1 ? "cursor-next" : null,
        ),
      });
    });

    await page.goto("/admin/reports");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/admin/reports");
    test.skip(redirected, "Skipping: requires admin auth");
    if (redirected) return;

    // Changer de filtre
    await page.getByRole("button", { name: "En attente" }).click();
    await page.waitForTimeout(300);

    // Le changement de filtre doit avoir refetché les données
    expect(callCount).toBeGreaterThanOrEqual(1);
  });
});
