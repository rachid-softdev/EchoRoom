import { test, expect } from "@playwright/test";
import path from "path";

const COMPONENT_PATH = path.resolve(
  __dirname,
  "../../src/app/admin/users/UsersPageClient.tsx",
);

function readComponent(): string {
  return require("fs").readFileSync(COMPONENT_PATH, "utf-8");
}

test.describe("Admin Users page", () => {
  test("component is default exported", () => {
    const source = readComponent();
    expect(source).toContain("export default function UsersPageClient");
  });

  test('page heading is "Gestion des utilisateurs"', () => {
    const source = readComponent();
    expect(source).toContain("Gestion des utilisateurs");
  });

  test("subtitle describes the page purpose", () => {
    const source = readComponent();
    expect(source).toContain("Recherchez et gérez les utilisateurs de la plateforme");
  });

  test("search input has placeholder Rechercher par nom ou email...", () => {
    const source = readComponent();
    expect(source).toContain('placeholder="Rechercher par nom ou email..."');
  });

  test("search has Search icon on left and X clear button on right", () => {
    const source = readComponent();
    expect(source).toMatch(/Search.*className="absolute left-3/);
    expect(source).toContain("<X className=\"w-4 h-4\" />");
    expect(source).toContain("setSearch(\"\")");
  });

  test("search is debounced at 300ms", () => {
    const source = readComponent();
    expect(source).toContain("setTimeout");
    expect(source).toContain("300");
    expect(source).toContain("setDebouncedSearch");
  });

  test("uses admin.listUsers query", () => {
    const source = readComponent();
    expect(source).toMatch(/\.admin\.listUsers\.useQuery/);
  });

  test("uses admin.getUserDetail query for selected user", () => {
    const source = readComponent();
    expect(source).toMatch(/\.admin\.getUserDetail\.useQuery/);
  });

  test("role badges map: ADMIN=default, USER=secondary, MODERATOR=outline", () => {
    const source = readComponent();
    expect(source).toContain('ADMIN: "default"');
    expect(source).toContain('USER: "secondary"');
    expect(source).toContain('MODERATOR: "outline"');
  });

  test("deleted users shown with line-through", () => {
    const source = readComponent();
    expect(source).toContain("deletedAt");
    expect(source).toContain("line-through");
  });

  test("detail view has back button with ChevronLeft", () => {
    const source = readComponent();
    expect(source).toContain("ChevronLeft");
    expect(source).toContain("setSelectedUserId(null)");
  });

  test("detail info card shows ID, credits, calls, likes, consent, date", () => {
    const source = readComponent();
    expect(source).toContain("Informations");
    expect(source).toContain("selectedUser.id");
    expect(source).toContain("selectedUser.credits");
    expect(source).toContain("selectedUser.totalCallsMade");
    expect(source).toContain("selectedUser.totalLikesReceived");
    expect(source).toContain("selectedUser.consentAcceptedAt");
    expect(source).toContain("selectedUser.createdAt");
  });

  test("detail stats card shows scenarios, comments, reactions counts", () => {
    const source = readComponent();
    expect(source).toContain("Statistiques");
    expect(source).toMatch(/_count\?\.scenarios/);
    expect(source).toMatch(/_count\?\.comments/);
    expect(source).toMatch(/_count\?\.reactions/);
  });

  test("empty state with Aucun utilisateur text", () => {
    const source = readComponent();
    expect(source).toContain("Aucun utilisateur");
    expect(source).toContain("Aucun utilisateur ne correspond à votre recherche");
  });
});
