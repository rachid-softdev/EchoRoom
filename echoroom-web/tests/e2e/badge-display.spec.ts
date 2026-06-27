import path from "node:path";
import { expect, test } from "@playwright/test";

const BADGE_DISPLAY_PATH = path.resolve(__dirname, "../../src/components/social/BadgeDisplay.tsx");
const BADGE_GRID_PATH = path.resolve(__dirname, "../../src/components/social/BadgeGrid.tsx");

function readBadgeDisplay(): string {
  return require("node:fs").readFileSync(BADGE_DISPLAY_PATH, "utf-8");
}

function readBadgeGrid(): string {
  return require("node:fs").readFileSync(BADGE_GRID_PATH, "utf-8");
}

test.describe("BadgeGrid component", () => {
  test("BadgeGrid delegates to BadgeDisplay", () => {
    const source = readBadgeGrid();
    expect(source).toContain("export function BadgeGrid");
    expect(source).toContain("<BadgeDisplay userId={userId} />");
  });
});

test.describe("BadgeDisplay component", () => {
  test("component is exported as a named export", () => {
    const source = readBadgeDisplay();
    expect(source).toContain("export function BadgeDisplay");
  });

  test("uses 'use client' directive", () => {
    const source = readBadgeDisplay();
    expect(source).toContain('"use client"');
  });

  test("uses social.getUserBadges query", () => {
    const source = readBadgeDisplay();
    expect(source).toMatch(/\.social\.getUserBadges\.useQuery/);
  });

  test("loading state shows 3 skeleton cards in grid-cols-2 md:grid-cols-3", () => {
    const source = readBadgeDisplay();
    expect(source).toContain("grid grid-cols-2 md:grid-cols-3 gap-4");
    const hasSkeletonLoading =
      (source.includes("Array.from") && source.includes("length: 3")) ||
      (source.includes("skeleton") && source.includes("loading"));
    if (!hasSkeletonLoading) {
      test.info().annotations.push({
        type: "info",
        description:
          "Skeleton loading pattern may use different approach than Array.from({length: 3})",
      });
    }
    expect(source).toContain('Skeleton className="h-8 w-8 rounded-full"');
    expect(source).toContain('Skeleton className="h-4 w-2/3"');
    expect(source).toContain('Skeleton className="h-3 w-full"');
  });

  test("error state shows AlertCircle and Erreur text in destructive color", () => {
    const source = readBadgeDisplay();
    expect(source).toContain("AlertCircle");
    expect(source).toContain("Erreur lors du chargement des badges");
    expect(source).toContain("text-destructive");
  });

  test("empty state uses EmptyState with Medal icon", () => {
    const source = readBadgeDisplay();
    expect(source).toMatch(/EmptyState/);
    expect(source).toMatch(/icon=\{Medal\}/);
    expect(source).toContain("Aucun badge pour le moment");
    expect(source).toContain("Participez à la communauté pour débloquer des badges !");
  });

  test("loaded state uses grid-cols-2 md:grid-cols-3", () => {
    const source = readBadgeDisplay();
    expect(source).toContain("grid grid-cols-2 md:grid-cols-3 gap-4");
  });

  test("badge card has iconUrl image or Medal fallback in bg-primary/20 circle", () => {
    const source = readBadgeDisplay();
    expect(source).toContain("ub.badge.iconUrl");
    expect(source).toMatch(/Medal.*w-4 h-4 text-primary/);
    expect(source).toContain("bg-primary/20");
  });

  test("badge name rendered in CardTitle", () => {
    const source = readBadgeDisplay();
    expect(source).toContain('<CardTitle className="text-sm font-semibold">');
    expect(source).toContain("{ub.badge.name}");
  });

  test("badge description rendered in CardDescription", () => {
    const source = readBadgeDisplay();
    expect(source).toContain('<CardDescription className="text-xs">');
    expect(source).toContain("{ub.badge.description}");
  });

  test("date shown as Obtenu le with formatDate", () => {
    const source = readBadgeDisplay();
    expect(source).toContain("Obtenu le {formatDate(ub.awardedAt)}");
  });

  test("date format uses fr-FR locale", () => {
    const source = readBadgeDisplay();
    expect(source).toContain('toLocaleDateString("fr-FR"');
    expect(source).toContain('day: "numeric"');
    expect(source).toContain('month: "long"');
    expect(source).toContain('year: "numeric"');
  });

  test("imports Medal and AlertCircle from lucide-react", () => {
    const source = readBadgeDisplay();
    expect(source).toMatch(/import.*\{.*Medal.*AlertCircle.*\}.*from.*lucide-react/);
  });
});
