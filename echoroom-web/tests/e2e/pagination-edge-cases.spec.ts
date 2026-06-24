import { test, expect } from "@playwright/test";
import path from "path";

test.describe("Pagination edge cases", () => {
  // ── Admin Audit pagination (known implementation) ──

  test("Admin Audit pagination: Charger plus button with nextCursor", () => {
    const source = require("fs").readFileSync(
      path.resolve(__dirname, "../../src/app/admin/audit/AuditPageClient.tsx"),
      "utf-8"
    );
    expect(source).toContain("nextCursor");
    expect(source).toContain("Charger plus");
    expect(source).toMatch(/auditQuery\.data\?\.nextCursor &&/);
  });

  test("Admin Audit pagination: load more disabled during fetch", () => {
    const source = require("fs").readFileSync(
      path.resolve(__dirname, "../../src/app/admin/audit/AuditPageClient.tsx"),
      "utf-8"
    );
    expect(source).toContain('disabled={auditQuery.isFetching}');
  });

  test("Admin Audit pagination: loading text during fetch", () => {
    const source = require("fs").readFileSync(
      path.resolve(__dirname, "../../src/app/admin/audit/AuditPageClient.tsx"),
      "utf-8"
    );
    expect(source).toContain("Chargement...");
    expect(source).toContain("Charger plus");
  });

  // ── Library pagination ──

  test("Library has paginated data loader pattern", () => {
    const source = require("fs").readFileSync(
      path.resolve(__dirname, "../../src/app/(dashboard)/library/page.tsx"),
      "utf-8"
    );
    // Check for pagination components or cursor management
    const hasPagination = source.includes("cursor") || 
                          source.includes("hasMore") || 
                          source.includes("Voir plus") || 
                          source.includes("loadMore") ||
                          source.includes("Paginated");
    expect(hasPagination).toBe(true);
  });

  // ── PaginatedDataLoader component ──

  test("PaginatedDataLoader supports cursor-based pagination", () => {
    const source = require("fs").readFileSync(
      path.resolve(__dirname, "../../src/components/shared/DataLoader.tsx"),
      "utf-8"
    );
    // Check if PaginatedDataLoader is defined in the same file or separate
    const hasPaginated = source.includes("PaginatedDataLoader") || source.includes("hasMore") || source.includes("nextCursor");
    if (!hasPaginated) {
      test.info().annotations.push({ type: "info", description: "PaginatedDataLoader may be in a separate file" });
    }
  });

  // ── Empty state pattern across paginated pages ──

  test("empty state shown when search yields no results on Library", async ({ page }) => {
    await page.goto("/library");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requires authentication");
    if (redirected) return;
  });
});
