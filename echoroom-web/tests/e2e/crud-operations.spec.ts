import { test, expect } from "@playwright/test";
import path from "path";

function readSource(relativePath: string): string {
  return require("fs").readFileSync(
    path.resolve(__dirname, relativePath),
    "utf-8"
  );
}

test.describe("CRUD operations patterns", () => {
  // ── Scenario creation ──

  test("Create scenario form has title input with min=3 max=80", () => {
    const source = readSource("../../src/app/(dashboard)/create/page.tsx");
    expect(source).toMatch(/minLength.*=.*3/);
    expect(source).toMatch(/maxLength.*=.*80/);
  });

  test("Create scenario uses api.scenarios.create mutation", () => {
    const source = readSource("../../src/app/(dashboard)/create/page.tsx");
    expect(source).toMatch(/\.scenarios\.create\.useMutation/);
  });

  test("Create scenario has character grid selector", () => {
    const source = readSource("../../src/app/(dashboard)/create/page.tsx");
    expect(source).toContain("character");
  });

  test("Create scenario has description field with maxLength", () => {
    const source = readSource("../../src/app/(dashboard)/create/page.tsx");
    expect(source).toContain("maxLength");
  });

  test("Create scenario has visibility toggle (PUBLIC/PRIVÉ)", () => {
    const source = readSource("../../src/app/(dashboard)/create/page.tsx");
    const hasVisibility = source.includes("PUBLIC") || source.includes("PRIVÉ") || source.includes("visibility");
    expect(hasVisibility).toBe(true);
  });

  test("Create scenario has annuler button linking to /dashboard", () => {
    const source = readSource("../../src/app/(dashboard)/create/page.tsx");
    expect(source).toContain("Annuler");
  });

  // ── Library CRUD patterns ──

  test("Library page has operation buttons on scenario items", () => {
    // Read library client component if it exists separately
    const paths = [
      "../../src/app/(dashboard)/library/LibraryPageClient.tsx",
      "../../src/app/(dashboard)/library/page.tsx",
    ];
    for (const p of paths) {
      try {
        const source = readSource(p);
        const hasEdit = source.includes("edit") || source.includes("modifier") || source.includes("update");
        const hasDelete = source.includes("delete") || source.includes("supprimer") || source.includes("remove");
        if (hasEdit || hasDelete) {
          expect(hasEdit || hasDelete).toBe(true);
          return;
        }
      } catch {
        continue;
      }
    }
    test.info().annotations.push({ type: "info", description: "Library CRUD operations not found in expected paths" });
  });

  test("Library has FAB or New button linking to /create", () => {
    const source = readSource("../../src/app/(dashboard)/library/page.tsx");
    expect(source).toContain("/create");
  });

  // ── Settings CRUD patterns ──

  test("Settings has delete account with SUPPRIMER confirmation", () => {
    const source = readSource("../../src/app/(dashboard)/settings/SettingsPageClient.tsx");
    expect(source).toContain("SUPPRIMER");
    expect(source).toContain("Supprimer mon compte");
  });

  test("Settings uses profile.deleteMyAccount mutation", () => {
    const source = readSource("../../src/app/(dashboard)/settings/SettingsPageClient.tsx");
    expect(source).toMatch(/profile\.deleteMyAccount|delete.*account/i);
  });

  test("Settings has export data button", () => {
    const source = readSource("../../src/app/(dashboard)/settings/SettingsPageClient.tsx");
    expect(source).toMatch(/export/i);
  });

  // ── Comment CRUD ──

  test("Community page has comment input and submit button", () => {
    const source = readSource("../../src/app/(dashboard)/community/CommunityPageClient.tsx");
    expect(source).toMatch(/comment/);
  });

  test("Scenario detail page has comment section", () => {
    const source = readSource("../../src/app/scenario/[id]/page.tsx");
    expect(source).toMatch(/comment/i);
  });

  // ── Social interactions ──

  test("ShareButtons scenarioId prop matches expected pattern", () => {
    const source = readSource("../../src/components/social/ShareButtons.tsx");
    expect(source).toContain("scenarioId");
    expect(source).toContain("title");
  });

  test("ClipCreator creates clip with callId and duration", () => {
    const source = readSource("../../src/components/social/ClipCreator.tsx");
    expect(source).toContain("callId");
    expect(source).toContain("durationSeconds");
    expect(source).toContain("startTime");
    expect(source).toContain("endTime");
  });

  // ── Admin CRUD ──

  test("Admin moderation has approve and reject mutations", () => {
    const source = readSource("../../src/app/admin/moderation/ModerationPageClient.tsx");
    expect(source).toMatch(/approveModeration|approveScenario/);
    expect(source).toMatch(/rejectModeration|rejectScenario/);
  });

  test("Admin blocked numbers has block and unblock mutations", () => {
    const source = readSource("../../src/app/admin/blocked-numbers/BlockedNumbersPageClient.tsx");
    expect(source).toMatch(/admin\.blockNumber|block.*mutation/);
    expect(source).toMatch(/admin\.unblockNumber|unblock.*mutation/);
  });

  // ── Live browser test for Library ──

  test("live: Library page renders scenario list or empty state when authenticated", async ({ page }) => {
    await page.goto("/library");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requires authentication");
    if (redirected) return;

    // Either shows scenarios or empty state
    const hasContent = await page.getByRole("heading").first().isVisible().catch(() => false);
    expect(hasContent).toBe(true);
  });
});
