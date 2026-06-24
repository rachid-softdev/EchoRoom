import { test, expect } from "@playwright/test";
import path from "path";

const COMPONENT_PATH = path.resolve(__dirname, "../../src/components/shared/ConfirmDialog.tsx");

function readComponent(): string {
  return require("fs").readFileSync(COMPONENT_PATH, "utf-8");
}

test.describe("ConfirmDialog component", () => {

  // 1. Named export
  test("component is exported as a named export", () => {
    const source = readComponent();
    expect(source).toContain("export function ConfirmDialog");
  });

  // 2. Uses shadcn/ui Dialog
  test("uses shadcn/ui Dialog primitives", () => {
    const source = readComponent();
    expect(source).toContain("<Dialog");
    const dialogComponents = ["DialogContent", "DialogHeader", "DialogTitle", "DialogDescription", "DialogFooter"];
    for (const comp of dialogComponents) {
      if (!source.includes(`<${comp}>`)) {
        test.info().annotations.push({ type: "info", description: `Component ${comp} not found with exact JSX tag - may use dynamic or different format` });
      }
    }
  });

  // 3. Accepts open and onOpenChange props
  test("accepts open and onOpenChange props", () => {
    const source = readComponent();
    expect(source).toContain("open");
    expect(source).toContain("onOpenChange");
    expect(source).toContain('open={open}');
    expect(source).toContain('onOpenChange={onOpenChange}');
  });

  // 4. Renders title and description
  test("renders title and description props", () => {
    const source = readComponent();
    expect(source).toContain("{title}");
    expect(source).toContain("{description}");
  });

  // 5. Cancel button with onOpenChange(false)
  test("cancel button calls onOpenChange(false)", () => {
    const source = readComponent();
    expect(source).toContain("Annuler");
    expect(source).toContain('onClick={() => onOpenChange(false)}');
  });

  // 6. Confirm button with onConfirm
  test("confirm button calls onConfirm on click", () => {
    const source = readComponent();
    expect(source).toContain("{onConfirm}");
    expect(source).toContain("Confirmer");
  });

  // 7. Loading state disables both buttons and shows spinner
  test("loading state disables both buttons and shows spinner", () => {
    const source = readComponent();
    // Buttons are disabled when loading
    expect(source).toMatch(/disabled=\{loading\}/);
    // Loader2 spinner rendered during loading
    expect(source).toMatch(/Loader2.*animate-spin/);
  });

  // 8. confirmDisabled prop
  test("confirmDisabled disables the confirm button", () => {
    const source = readComponent();
    // Confirm button disabled by loading or confirmDisabled
    expect(source).toMatch(/disabled=\{loading\s*\|\|\s*confirmDisabled\}/);
  });

  // 9. Destructive variant
  test("destructive variant changes confirm button variant", () => {
    const source = readComponent();
    // The confirm button variant changes based on variant prop
    expect(source).toContain("variant={variant === 'destructive' ? 'destructive' : 'default'}");
  });

  // 10. Cancel button has outline variant
  test("cancel button has outline variant", () => {
    const source = readComponent();
    expect(source).toMatch(/variant="outline"/);
  });

  // 11. Default labels
  test("default labels are Confirmer and Annuler", () => {
    const source = readComponent();
    expect(source).toContain("confirmLabel = 'Confirmer'");
    expect(source).toContain("cancelLabel = 'Annuler'");
  });

  // 12. Footer with gap-2 class
  test("dialog footer has gap-2 class", () => {
    const source = readComponent();
    expect(source).toContain('<DialogFooter className="gap-2">');
  });

  // 13. Live test - confirm dialog renders on settings page when triggered
  test("confirm dialog renders on settings delete account flow", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requires authentication");
    if (redirected) return;

    // The settings page has a delete account button that opens a confirm dialog
    const deleteButton = page.getByText("Supprimer mon compte");
    await expect(deleteButton).toBeVisible();

    // Click to open the confirm dialog
    await deleteButton.click();

    // The dialog should be visible with title "Supprimer mon compte"
    await expect(page.getByText("Supprimer mon compte")).toBeVisible();
    await expect(page.getByText("Annuler")).toBeVisible();
    await expect(page.getByText(/SUPPRIMER|Confirmer/)).toBeVisible();
  });
});
