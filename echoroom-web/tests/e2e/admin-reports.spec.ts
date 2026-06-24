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
