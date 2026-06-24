import { test, expect } from "@playwright/test";
import path from "path";

const COMPONENT_PATH = path.resolve(
  __dirname,
  "../../src/components/admin/CommentModerationTab.tsx",
);

function readComponent(): string {
  return require("fs").readFileSync(COMPONENT_PATH, "utf-8");
}

test.describe("CommentModerationTab component", () => {
  test("component is exported as a named export", () => {
    const source = readComponent();
    expect(source).toContain("export function CommentModerationTab");
  });

  test("uses 'use client' directive", () => {
    const source = readComponent();
    expect(source).toContain('"use client"');
  });

  test("status filter defaults to PENDING", () => {
    const source = readComponent();
    expect(source).toContain('useState<"PENDING" | "REJECTED">("PENDING")');
  });

  test("filter buttons En attente and Rejetés with active variant switching", () => {
    const source = readComponent();
    expect(source).toContain("En attente");
    expect(source).toContain("Rejetés");
    expect(source).toMatch(/status === "PENDING" \? "default" : "outline"/);
    expect(source).toContain('onClick={() => setStatus("PENDING")}');
    expect(source).toContain('onClick={() => setStatus("REJECTED")}');
  });

  test("uses admin.moderationQueueComments query", () => {
    const source = readComponent();
    expect(source).toMatch(/\.admin\.moderationQueueComments\.useQuery/);
  });

  test("wrapped in DataLoader with isEmpty check", () => {
    const source = readComponent();
    expect(source).toContain("<DataLoader");
    expect(source).toContain("isEmpty={(data) => data.items.length === 0}");
  });

  test("empty state for PENDING shows Aucun commentaire en attente", () => {
    const source = readComponent();
    expect(source).toContain("Aucun commentaire en attente");
  });

  test("empty state for REJECTED shows Aucun commentaire rejeté", () => {
    const source = readComponent();
    expect(source).toContain("Aucun commentaire rejeté");
  });

  test("empty state description is Tous les commentaires ont été modérés", () => {
    const source = readComponent();
    expect(source).toContain("Tous les commentaires ont été modérés");
  });

  test("comment card shows username, scenario link, content, date", () => {
    const source = readComponent();
    expect(source).toMatch(/comment\.user\.username/);
    expect(source).toMatch(/comment\.scenario\.id/);
    expect(source).toMatch(/comment\.scenario\.title/);
    expect(source).toContain("comment.content");
    expect(source).toContain("comment.createdAt");
  });

  test("PENDING comments show Approuver and Rejeter buttons", () => {
    const source = readComponent();
    expect(source).toContain("Approuver");
    expect(source).toContain("Rejeter");
  });

  test("approve button disabled when approveMutation.isPending", () => {
    const source = readComponent();
    expect(source).toContain('disabled={approveMutation.isPending}');
  });

  test("reject button disabled when rejectMutation.isPending", () => {
    const source = readComponent();
    expect(source).toContain('disabled={rejectMutation.isPending}');
  });

  test("uses admin.approveComment and admin.rejectComment mutations", () => {
    const source = readComponent();
    expect(source).toMatch(/\.admin\.approveComment\.useMutation/);
    expect(source).toMatch(/\.admin\.rejectComment\.useMutation/);
  });
});
