import path from "node:path";
import { expect, test } from "@playwright/test";

const COMPONENT_PATH = path.resolve(__dirname, "../../src/components/social/FeaturedScenario.tsx");

function readComponent(): string {
  return require("node:fs").readFileSync(COMPONENT_PATH, "utf-8");
}

test.describe("FeaturedScenario component", () => {
  test("component is exported as a named export", () => {
    const source = readComponent();
    expect(source).toContain("export function FeaturedScenario");
  });

  test("uses 'use client' directive", () => {
    const source = readComponent();
    expect(source).toContain('"use client"');
  });

  test("uses social.getFeatured query", () => {
    const source = readComponent();
    expect(source).toMatch(/\.social\.getFeatured\.useQuery/);
  });

  test("loading state shows skeleton with rounded-full and 3 bars", () => {
    const source = readComponent();
    expect(source).toContain('Skeleton className="w-16 h-16 rounded-full shrink-0"');
    expect(source).toContain('Skeleton className="h-4 w-32"');
    expect(source).toContain('Skeleton className="h-6 w-48"');
    expect(source).toContain('Skeleton className="h-4 w-full max-w-md"');
  });

  test("null data returns null (hidden)", () => {
    const source = readComponent();
    expect(source).toMatch(/if\s*\(!scenario\)\s*return\s*null/);
  });

  test("card has border-primary/20 bg-primary/5 classes", () => {
    const source = readComponent();
    expect(source).toContain('className="border-primary/20 bg-primary/5 mb-8 overflow-hidden"');
  });

  test("character avatar has ring-2 ring-primary/20 and w-16 h-16", () => {
    const source = readComponent();
    expect(source).toContain("ring-2 ring-primary/20");
    expect(source).toContain("w-16 h-16");
  });

  test("avatar fallback renders first character of name with bg-primary/10", () => {
    const source = readComponent();
    expect(source).toMatch(/AvatarFallback.*bg-primary\/10.*text-primary/);
    expect(source).toMatch(/scenario\.character\.name\?\.charAt\(0\)/);
  });

  test("badge Scénario du jour with Star icon", () => {
    const source = readComponent();
    expect(source).toContain("Scénario du jour");
    expect(source).toMatch(/Star.*w-3 h-3/);
    expect(source).toContain("border-primary/30");
  });

  test("title rendered as h3 with truncate class", () => {
    const source = readComponent();
    expect(source).toContain('<h3 className="text-lg font-bold mb-1 truncate">');
    expect(source).toContain("{scenario.title}");
  });

  test("description conditionally rendered with line-clamp-2", () => {
    const source = readComponent();
    expect(source).toContain("line-clamp-2");
    expect(source).toMatch(/scenario\.description &&/);
  });

  test("stats row shows Heart + likeCount and Play + playCount", () => {
    const source = readComponent();
    expect(source).toMatch(/Heart.*w-3 h-3/);
    expect(source).toMatch(/likeCount/);
    expect(source).toMatch(/Play.*w-3 h-3/);
    expect(source).toMatch(/playCount/);
  });

  test("creator shown as 'par {creator.username}' conditionally", () => {
    const source = readComponent();
    expect(source).toMatch(/scenario\.creator &&/);
    expect(source).toContain("par {scenario.creator.username}");
  });

  test("CTA Démarrer button links to /create?scenario={id}", () => {
    const source = readComponent();
    expect(source).toMatch(/Link.*href=.*\/create\?scenario=.*scenario\.id/);
    expect(source).toContain("Démarrer");
  });
});
