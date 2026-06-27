import path from "node:path";
import { expect, test } from "@playwright/test";

const COMPONENT_PATH = path.resolve(__dirname, "../../src/app/admin/analytics/page.tsx");

function readComponent(): string {
  return require("node:fs").readFileSync(COMPONENT_PATH, "utf-8");
}

test.describe("Admin Analytics page", () => {
  test("page is exported as default function", () => {
    const source = readComponent();
    expect(source).toContain("export default function AnalyticsPage");
  });

  test("page heading is Analytiques", () => {
    const source = readComponent();
    expect(source).toContain("Analytiques");
  });

  test("status badge shows Statistiques en cours with pulse animation", () => {
    const source = readComponent();
    expect(source).toContain("Statistiques en cours");
    expect(source).toContain("animate-pulse-soft");
  });

  test("stats grid has md:grid-cols-2 lg:grid-cols-4 layout", () => {
    const source = readComponent();
    expect(source).toContain("grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8");
  });

  test("4 placeholder stat cards exist", () => {
    const source = readComponent();
    // Count the items in the stats array
    const statMatches = source.match(/{ label:/g);
    expect(statMatches).toBeTruthy();
    expect(statMatches!.length).toBeGreaterThanOrEqual(4);
  });

  test("stat cards have emoji icons and labels", () => {
    const source = readComponent();
    expect(source).toContain("Utilisateurs total");
    expect(source).toContain("Appels total");
    expect(source).toContain("Scénarios créés");
    expect(source).toContain("Revenus");
  });

  test("stat cards show placeholder text about deployment", () => {
    const source = readComponent();
    expect(source).toContain("Données disponibles après le déploiement");
  });

  test("roadmap card has BarChart3 icon and title", () => {
    const source = readComponent();
    expect(source).toMatch(/BarChart3/);
    expect(source).toContain("Tableau de bord analytique");
  });

  test("roadmap has 4 bullet points with TrendingUp icons", () => {
    const source = readComponent();
    const trendingMatches = source.match(/TrendingUp/g);
    expect(trendingMatches).toBeTruthy();
    expect(trendingMatches!.length).toBeGreaterThanOrEqual(4);
  });

  test("link cards to other admin tools exist", () => {
    const source = readComponent();
    expect(source).toContain("/admin/users");
    expect(source).toContain("/admin/moderation");
    expect(source).toContain("/admin/reports");
    expect(source).toContain("Gestion des utilisateurs");
    expect(source).toContain("Modération");
    expect(source).toContain("Signalements");
  });

  test("link cards have ArrowUpRight icon with hover effect", () => {
    const source = readComponent();
    expect(source).toMatch(/ArrowUpRight/);
    expect(source).toContain("group-hover:text-foreground transition-colors");
  });
});
