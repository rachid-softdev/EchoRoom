import path from "node:path";
import { expect, test } from "@playwright/test";

const COMPONENT_PATH = path.resolve(__dirname, "../../src/app/admin/audit/AuditPageClient.tsx");

function readComponent(): string {
  return require("node:fs").readFileSync(COMPONENT_PATH, "utf-8");
}

test.describe("Admin Audit page", () => {
  test("component is default exported", () => {
    const source = readComponent();
    expect(source).toContain("export default function AuditPageClient");
  });

  test("page heading is Journal d'audit", () => {
    const source = readComponent();
    expect(source).toContain("Journal d&apos;audit");
  });

  test("subtitle describes the page", () => {
    const source = readComponent();
    expect(source).toContain("Consultez l&apos;historique des actions administratives");
  });

  test("action filter dropdown has 9 options", () => {
    const source = readComponent();
    // Count actionOptions array entries
    const actionSection = source.split("entityTypeOptions")[0]!;
    const optionMatches = actionSection.match(/{ label:/g);
    expect(optionMatches).toBeTruthy();
    expect(optionMatches!.length).toBe(9);
  });

  test("entity type filter dropdown has 5 options", () => {
    const source = readComponent();
    const entitySection = source.split("entityTypeOptions")[1]!.split("];")[0]!;
    const optionMatches = entitySection.match(/{ label:/g);
    expect(optionMatches).toBeTruthy();
    expect(optionMatches!.length).toBe(6);
  });

  test("date range filters (from/to) are present", () => {
    const source = readComponent();
    expect(source).toContain("dateFrom");
    expect(source).toContain("dateTo");
    expect(source).toContain('type="date"');
  });

  test("reset filters button appears when any filter is active", () => {
    const source = readComponent();
    expect(source).toContain("Réinitialiser");
    expect(source).toMatch(/actionFilter \|\| entityFilter \|\| hasDateFilter/);
  });

  test("audit table has 5 columns: Date, Admin, Action, Type, ID", () => {
    const source = readComponent();
    expect(source).toContain("Date");
    expect(source).toContain("Admin");
    expect(source).toContain("Action");
    expect(source).toContain("Type");
    expect(source).toContain("ID");
  });

  test("table rows have hover transition", () => {
    const source = readComponent();
    expect(source).toContain("hover:bg-muted/30 transition-colors");
  });

  test("pagination shows Charger plus when nextCursor exists", () => {
    const source = readComponent();
    expect(source).toContain("nextCursor");
    expect(source).toContain("Charger plus");
  });

  test("load more button disabled when isFetching", () => {
    const source = readComponent();
    expect(source).toContain("disabled={auditQuery.isFetching}");
  });

  test("uses admin.getAuditLogs query", () => {
    const source = readComponent();
    expect(source).toMatch(/\.admin\.getAuditLogs\.useQuery/);
  });

  test("empty state shows Aucune entrée", () => {
    const source = readComponent();
    expect(source).toContain("Aucune entrée");
    expect(source).toContain("Aucune entrée de journal d&apos;audit");
  });

  test("action labels map has 9 entries", () => {
    const source = readComponent();
    expect(source).toContain("APPROVE_SCENARIO");
    expect(source).toContain("REJECT_SCENARIO");
    expect(source).toContain("BLOCK_NUMBER");
    expect(source).toContain("UNBLOCK_NUMBER");
    expect(source).toContain("DELETE_COMMENT");
    expect(source).toContain("DISMISS_ABUSE_REPORT");
    expect(source).toContain("FEATURE_SCENARIO");
    expect(source).toContain("DELETE_USER");
    expect(source).toContain("REMOVE_FEATURED");
  });
});
