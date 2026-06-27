import path from "node:path";
import { expect, test } from "@playwright/test";

const COMPONENT_PATH = path.resolve(__dirname, "../../src/components/admin/AdminSidebar.tsx");

function readComponent(): string {
  return require("node:fs").readFileSync(COMPONENT_PATH, "utf-8");
}

test.describe("AdminSidebar component", () => {
  test("component is exported as a named export", () => {
    const source = readComponent();
    expect(source).toContain("export function AdminSidebar");
  });

  test("uses 'use client' directive", () => {
    const source = readComponent();
    expect(source).toContain('"use client"');
  });

  test("uses usePathname for active state detection", () => {
    const source = readComponent();
    expect(source).toMatch(/import.*usePathname.*from.*next\/navigation/);
    expect(source).toContain("const pathname = usePathname()");
  });

  test("header shows EchoRoom Admin with LayoutDashboard icon", () => {
    const source = readComponent();
    expect(source).toContain("EchoRoom Admin");
    expect(source).toMatch(/LayoutDashboard/);
    expect(source).toContain("/admin/moderation");
  });

  test("has 6 nav items with correct routes and icons", () => {
    const source = readComponent();
    expect(source).toContain("Modération");
    expect(source).toContain("/admin/moderation");
    expect(source).toContain("Signalements");
    expect(source).toContain("/admin/reports");
    expect(source).toContain("Journal d'audit");
    expect(source).toContain("/admin/audit");
    expect(source).toContain("Numéros bloqués");
    expect(source).toContain("/admin/blocked-numbers");
    expect(source).toContain("Utilisateurs");
    expect(source).toContain("/admin/users");
    expect(source).toContain("Analytiques");
    expect(source).toContain("/admin/analytics");
  });

  test("icons: Shield, Flag, ScrollText, Ban, Users, BarChart3", () => {
    const source = readComponent();
    expect(source).toMatch(/Shield/);
    expect(source).toMatch(/Flag/);
    expect(source).toMatch(/ScrollText/);
    expect(source).toMatch(/Ban/);
    expect(source).toMatch(/Users/);
    expect(source).toMatch(/BarChart3/);
  });

  test("active link has bg-primary/10 text-primary font-medium classes", () => {
    const source = readComponent();
    expect(source).toContain("bg-primary/10 text-primary font-medium");
  });

  test("inactive link has hover effects", () => {
    const source = readComponent();
    expect(source).toContain("text-muted-foreground hover:text-foreground hover:bg-muted/50");
  });

  test('active link has aria-current="page"', () => {
    const source = readComponent();
    expect(source).toContain('aria-current={isActive ? "page" : undefined}');
  });

  test("sidebar has fixed w-64 width", () => {
    const source = readComponent();
    expect(source).toContain("w-64 shrink-0");
  });

  test("ThemeToggle in footer section", () => {
    const source = readComponent();
    expect(source).toMatch(/ThemeToggle/);
    expect(source).toMatch(/border-t/);
  });
});
