import { test, expect } from "@playwright/test";
import path from "path";

test.describe("Concurrent operations & optimistic updates", () => {
  // ── Double-submit prevention in forms ──

  test("Register submit button disabled during loading", () => {
    const source = require("fs").readFileSync(
      path.resolve(__dirname, "../../src/app/(auth)/register/page.tsx"),
      "utf-8"
    );
    expect(source).toMatch(/disabled=\{loading \|\| !consentAccepted \|\| passwordStrength < 3\}/);
    expect(source).toContain("Loader2");
  });

  test("Login submit button disabled during loading", () => {
    const source = require("fs").readFileSync(
      path.resolve(__dirname, "../../src/app/(auth)/login/page.tsx"),
      "utf-8"
    );
    expect(source).toContain('disabled={loading}');
    expect(source).toContain("Loader2");
  });

  test("Create scenario button disabled during mutation", () => {
    const source = require("fs").readFileSync(
      path.resolve(__dirname, "../../src/components/social/ClipCreator.tsx"),
      "utf-8"
    );
    expect(source).toMatch(/disabled=\{!isValid \|\| createMutation\.isPending\}/);
  });

  test("Report button disabled during mutation", () => {
    const source = require("fs").readFileSync(
      path.resolve(__dirname, "../../src/components/social/ReportButton.tsx"),
      "utf-8"
    );
    expect(source).toMatch(/disabled=\{reason\.trim\(\)\.length < MIN_REPORT_REASON_LENGTH \|\| reportMutation\.isPending\}/);
  });

  // ── Optimistic updates ──

  test("ReactionBar disables all buttons during toggle mutation", () => {
    const source = require("fs").readFileSync(
      path.resolve(__dirname, "../../src/components/social/ReactionBar.tsx"),
      "utf-8"
    );
    expect(source).toMatch(/disabled=\{toggleMutation\.isPending\}/);
  });

  test("ReactionBar refetches reactions on mutation success", () => {
    const source = require("fs").readFileSync(
      path.resolve(__dirname, "../../src/components/social/ReactionBar.tsx"),
      "utf-8"
    );
    expect(source).toContain("reactionsQuery.refetch()");
  });

  // ── Share buttons disabled during tracking ──

  test("ShareButtons disabled during trackMutation", () => {
    const source = require("fs").readFileSync(
      path.resolve(__dirname, "../../src/components/social/ShareButtons.tsx"),
      "utf-8"
    );
    const matches = source.match(/disabled=\{trackMutation\.isPending\}/g);
    expect(matches).toBeTruthy();
    expect(matches!.length).toBe(4);
  });

  // ── Admin approve/reject button disabled during mutation ──

  test("Admin moderation approve button disabled during mutation", () => {
    const source = require("fs").readFileSync(
      path.resolve(__dirname, "../../src/app/admin/moderation/ModerationPageClient.tsx"),
      "utf-8"
    );
    expect(source).toMatch(/disabled=\{approveMutation\.isPending\}/);
  });

  test("Admin moderation reject button disabled during mutation", () => {
    const source = require("fs").readFileSync(
      path.resolve(__dirname, "../../src/app/admin/moderation/ModerationPageClient.tsx"),
      "utf-8"
    );
    expect(source).toMatch(/disabled=\{rejectMutation\.isPending\}/);
  });

  // ── Comment moderation buttons disabled during mutations ──

  test("Comment approve button disabled during mutation", () => {
    const source = require("fs").readFileSync(
      path.resolve(__dirname, "../../src/components/admin/CommentModerationTab.tsx"),
      "utf-8"
    );
    expect(source).toContain('disabled={approveMutation.isPending}');
  });

  test("Comment reject button disabled during mutation", () => {
    const source = require("fs").readFileSync(
      path.resolve(__dirname, "../../src/components/admin/CommentModerationTab.tsx"),
      "utf-8"
    );
    expect(source).toContain('disabled={rejectMutation.isPending}');
  });

  // ── Toast success/error callbacks ──

  test("Clip creation shows toast on success and error", () => {
    const source = require("fs").readFileSync(
      path.resolve(__dirname, "../../src/components/social/ClipCreator.tsx"),
      "utf-8"
    );
    expect(source).toContain('title: "Clip créé !"');
    expect(source).toContain('title: err.message || "Erreur lors de la création du clip"');
  });

  // ── Form reset after successful submission ──

  test("Clip creator resets form fields after success", () => {
    const source = require("fs").readFileSync(
      path.resolve(__dirname, "../../src/components/social/ClipCreator.tsx"),
      "utf-8"
    );
    expect(source).toContain('setTitle("")');
    expect(source).toContain("setStartTime(0)");
    expect(source).toContain("setEndTime(durationSeconds)");
  });

  test("Report button resets reason after success", () => {
    const source = require("fs").readFileSync(
      path.resolve(__dirname, "../../src/components/social/ReportButton.tsx"),
      "utf-8"
    );
    expect(source).toContain('setReason("")');
    expect(source).toContain("setOpen(false)");
  });

  test("Admin blocked numbers form resets after block success", () => {
    const source = require("fs").readFileSync(
      path.resolve(__dirname, "../../src/app/admin/blocked-numbers/BlockedNumbersPageClient.tsx"),
      "utf-8"
    );
    expect(source).toContain('setPhoneNumber("")');
    expect(source).toContain('setReason("")');
  });
});
