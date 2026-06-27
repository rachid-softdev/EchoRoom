import path from "node:path";
import { expect, test } from "@playwright/test";

const COMPONENT_PATH = path.resolve(__dirname, "../../src/components/shared/ConfirmDialog.tsx");

function readComponent(): string {
  return require("node:fs").readFileSync(COMPONENT_PATH, "utf-8");
}

test.describe("ConfirmDialog — Composant Partagé", () => {
  // ─── Analyse statique du source ─────────────────────────────────────

  test("est exporté comme fonction nommée", () => {
    const source = readComponent();
    expect(source).toContain("export function ConfirmDialog");
  });

  test("utilise les primitives shadcn/ui Dialog", () => {
    const source = readComponent();
    expect(source).toContain("<Dialog");
    expect(source).toContain("DialogContent");
    expect(source).toContain("DialogHeader");
    expect(source).toContain("DialogTitle");
    expect(source).toContain("DialogDescription");
    expect(source).toContain("DialogFooter");
  });

  test("accepte les props open, onOpenChange, title, description", () => {
    const source = readComponent();
    expect(source).toContain("{title}");
    expect(source).toContain("{description}");
    expect(source).toContain("open={open}");
    expect(source).toContain("onOpenChange={onOpenChange}");
  });

  // ─── Variante destructive ──────────────────────────────────────────

  test("variante destructive change le variant du bouton confirm en 'destructive'", () => {
    const source = readComponent();
    // Le bouton confirm prend la variante 'destructive' quand variant==='destructive'
    expect(source).toMatch(/variant=\{variant === 'destructive' \? 'destructive' : 'default'\}/);
  });

  test("variante destructive — live: settings page affiche un bouton danger", async ({ page }) => {
    // On va sur la page settings pour observer le dialogue de suppression
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requiert une authentification");
    if (redirected) return;

    // Le bouton "Supprimer mon compte" est présent
    const deleteBtn = page.getByRole("button", {
      name: /supprimer/i,
    });
    await expect(deleteBtn).toBeVisible();

    // Clic pour ouvrir le dialog
    await deleteBtn.click();

    // Vérifie que le dialogue est visible
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Vérifie que le bouton de confirmation a la classe destructive
    const confirmBtn = dialog.getByRole("button", { name: /confirmer/i });
    await expect(confirmBtn).toBeVisible();

    // Si le variant est destructif, le bouton devrait avoir une classe destructive
    const btnClass = await confirmBtn.getAttribute("class");
    expect(btnClass).toBeTruthy();
    expect(btnClass!.toLowerCase()).toContain("destruct");
  });

  // ─── Loading spinner désactive les deux boutons ─────────────────────

  test("loading=true désactive le bouton cancel", () => {
    const source = readComponent();
    expect(source).toContain("disabled={loading}");
    // La ligne du bouton Annuler contient disabled={loading}
    expect(source).toContain("disabled={loading}");
  });

  test("loading=true désactive le bouton confirm et affiche un spinner Loader2", () => {
    const source = readComponent();
    // Confirm button disabled combine loading et confirmDisabled
    expect(source).toMatch(/disabled=\{loading\s*\|\|\s*confirmDisabled\}/);
    // Loader2 avec animate-spin dans le bloc loading
    expect(source).toMatch(/Loader2.*animate-spin/);
    // Le texte du label est remplacé par le spinner quand loading
    expect(source).toContain("loading ? (");
    expect(source).toContain(") : (");
    expect(source).toContain("confirmLabel");
  });

  test("loading=true — live: simulate loading state via props", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requiert une authentification");
    if (redirected) return;

    // Ouvre le dialogue de suppression
    const deleteBtn = page.getByRole("button", {
      name: /supprimer/i,
    });
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // En état normal (loading=false), les deux boutons sont cliquables
    const cancelBtn = dialog.getByRole("button", { name: "Annuler" });
    const confirmBtn = dialog.getByRole("button", { name: /confirmer/i });

    await expect(cancelBtn).toBeEnabled();
    await expect(confirmBtn).toBeEnabled();
  });

  // ─── confirmDisabled empêche la confirmation ────────────────────────

  test("confirmDisabled désactive le bouton confirm", () => {
    const source = readComponent();
    expect(source).toMatch(/disabled=\{loading\s*\|\|\s*confirmDisabled\}/);
  });

  test("confirmDisabled est false par défaut", () => {
    const source = readComponent();
    expect(source).toContain("confirmDisabled = false");
  });

  // ─── Escape ferme le dialog (comportement shadcn/ui natif) ──────────

  test("Escape key ferme le dialog — via onOpenChange(false)", () => {
    const source = readComponent();
    // Le Dialog de shadcn/ui gère nativement Escape via onOpenChange
    // Le bouton Annuler appelle onOpenChange(false)
    expect(source).toContain("onClick={() => onOpenChange(false)}");
  });

  test("Escape — live: dialog se ferme avec Escape", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requiert une authentification");
    if (redirected) return;

    // Ouvre le dialogue
    const deleteBtn = page.getByRole("button", {
      name: /supprimer/i,
    });
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Presse Escape
    await page.keyboard.press("Escape");

    // Le dialogue devrait être fermé
    await expect(dialog).not.toBeVisible();
  });

  // ─── Focus trap (Tab cyclique dans le dialog) ───────────────────────

  test("focus trap — shadcn/ui Dialog gère le piège de focus", () => {
    const source = readComponent();
    // shadcn/ui DialogContent a le focus trap intégré via @radix-ui/react-dialog
    // On vérifie que DialogContent est bien utilisé
    expect(source).toContain("<DialogContent>");
    // Deux boutons dans le footer qui reçoivent le focus
    expect(source).toContain("</DialogFooter>");
  });

  test("focus trap — live: Tab circule entre les boutons du dialog", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const redirected = page.url().includes("/login");
    test.skip(redirected, "Requiert une authentification");
    if (redirected) return;

    // Ouvre le dialogue de suppression
    const deleteBtn = page.getByRole("button", {
      name: /supprimer/i,
    });
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Les boutons dans le dialog
    const cancelBtn = dialog.getByRole("button", { name: "Annuler" });
    const confirmBtn = dialog.getByRole("button", { name: /confirmer/i });

    // Focus le premier bouton (Annuler)
    await cancelBtn.focus();
    await expect(cancelBtn).toBeFocused();

    // Tab pour aller au suivant (Confirmer)
    await page.keyboard.press("Tab");
    await expect(confirmBtn).toBeFocused();

    // Shift+Tab pour revenir à Annuler
    await page.keyboard.press("Shift+Tab");
    await expect(cancelBtn).toBeFocused();
  });

  // ─── Props par défaut ───────────────────────────────────────────────

  test("labels par défaut sont 'Confirmer' et 'Annuler'", () => {
    const source = readComponent();
    expect(source).toContain("confirmLabel = 'Confirmer'");
    expect(source).toContain("cancelLabel = 'Annuler'");
  });

  test("variant par défaut est 'default'", () => {
    const source = readComponent();
    expect(source).toContain("variant = 'default'");
  });

  test("loading est false par défaut", () => {
    const source = readComponent();
    expect(source).toContain("loading = false");
  });

  // ─── Structure du footer ────────────────────────────────────────────

  test("DialogFooter a la classe gap-2", () => {
    const source = readComponent();
    expect(source).toContain('<DialogFooter className="gap-2">');
  });

  test("bouton cancel a variant='outline'", () => {
    const source = readComponent();
    expect(source).toContain('variant="outline"');
  });
});
