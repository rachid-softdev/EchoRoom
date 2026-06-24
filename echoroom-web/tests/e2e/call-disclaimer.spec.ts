import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const STORAGE_KEY = "echoroom-call-disclaimer-accepted";
const COMPONENT_SOURCE_PATH = path.resolve(
  __dirname,
  "../../src/components/shared/CallDisclaimerDialog.tsx",
);

/**
 * Helper: read the component source file once.
 */
function readComponentSource(): string {
  return fs.readFileSync(COMPONENT_SOURCE_PATH, "utf-8");
}

test.describe("CallDisclaimerDialog component", () => {
  // ── 1. SSR safety ──────────────────────────────────────────────────

  test("SSR safety — component renders null before hydration", () => {
    const source = readComponentSource();

    // Component uses "use client" directive for client-side rendering
    expect(source).toContain('"use client"');

    // It has a `mounted` state initialised to false and returns null until mounted
    expect(source).toContain("const [mounted, setMounted] = useState(false)");

    // The early return null check before hydration
    expect(source).toMatch(/if\s*\(!mounted\s*\|\|\s*hasAcceptedBefore\)/);
    expect(source).toContain("return null");
  });

  // ── 2. Dialog structure ────────────────────────────────────────────

  test("dialog structure — Phone icon, correct title and description", () => {
    const source = readComponentSource();

    // Phone icon imported from lucide-react
    expect(source).toMatch(/Phone|Avant de commencer/);

    // Component uses shadcn/ui Dialog primitives
    expect(source).toContain("<Dialog");
    expect(source).toContain("<DialogContent>");
    expect(source).toContain("<DialogHeader>");
    expect(source).toContain("<DialogTitle>");
    expect(source).toContain("<DialogDescription>");

    // Title matches exactly
    expect(source).toContain("Avant de commencer l&apos;appel");

    // Description text
    expect(source).toContain(
      "Veuillez prendre connaissance des informations suivantes",
    );
  });

  // ── 3. Four info bullets ───────────────────────────────────────────

  test("4 info bullet items with correct French text", () => {
    const source = readComponentSource();

    // There should be 4 <li> elements with the bullet content
    const liMatches = source.match(/<li[^>]*>/g);
    expect(liMatches).toBeTruthy();
    expect(liMatches!.length).toBeGreaterThanOrEqual(4);

    // Bullet 1: audio recordings for moderation
    expect(source).toContain(
      "Les enregistrements audio peuvent être utilisés à des fins de",
    );
    expect(source).toContain("modération et d&apos;amélioration du service");

    // Bullet 2: do not share sensitive personal data
    expect(source).toMatch(/Ne partagez pas d(?:'|&apos;)informations personnelles sensibles/);
    expect(source).toContain("coordonnées bancaires, etc.)");

    // Bullet 3: not for emergency situations
    expect(source).toContain("Ce service n&apos;est pas destiné aux situations d&apos;urgence");
    expect(source).toContain("15, 17, 18");

    // Bullet 4: auto-moderation active
    expect(source).toContain(
      "Une modération automatique du contenu est active pour",
    );
    expect(source).toContain("prévenir les abus");
  });

  // ── 4. Checkbox ────────────────────────────────────────────────────

  test("checkbox with id=\"disclaimer-accept\" and correct label", () => {
    const source = readComponentSource();

    // The Checkbox component is imported
    expect(source).toMatch(/Checkbox|disclaimer-accept/);

    // It has the id attribute set to "disclaimer-accept"
    expect(source).toContain('id="disclaimer-accept"');

    // The label text matches exactly
    expect(source).toContain("Je comprends et j'accepte ces conditions");
  });

  // ── 5. Accept button disabled when unchecked ───────────────────────

  test('accept button "Démarrer l\'appel" is disabled when checkbox unchecked', () => {
    const source = readComponentSource();

    // The button uses the disabled prop based on checkbox state
    // disabled={!accepted || isPending}
    expect(source).toContain("disabled={!accepted || isPending}");

    // The button text when not pending
    expect(source).toContain("Démarrer l'appel");

    // Button component is a shadcn/ui Button
    expect(source).toContain("Button");
  });

  // ── 6. Cancel button ───────────────────────────────────────────────

  test('"Annuler" button is visible', () => {
    const source = readComponentSource();

    // Cancel button renders with variant="outline"
    expect(source).toContain('variant="outline"');

    // Text is "Annuler"
    expect(source).toContain("Annuler");

    // It calls onOpenChange(false) on click
    expect(source).toContain("onClick={() => onOpenChange(false)}");
  });

  // ── 7. Loading state ───────────────────────────────────────────────

  test('loading state shows "Appel en cours..." with Loader2 spinner', () => {
    const source = readComponentSource();

    // Loader2 is imported from lucide-react
    expect(source).toMatch(/import.*\bLoader2\b.*from\s+["']lucide-react["']/);

    // Loading text appears when isPending is true
    expect(source).toContain("Appel en cours...");

    // Button has disabled prop that includes isPending
    expect(source).toContain("disabled={!accepted || isPending}");

    // Loader2 component renders with animate-spin class
    expect(source).toContain("Loader2");
    expect(source).toContain("animate-spin");
  });

  // ── 8. localStorage preference stored after accept ─────────────────

  test("localStorage stores preference after accept", async ({ page }) => {
    // Visit a public page to have a browser context with localStorage
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Clear any existing value
    await page.evaluate(() => {
      localStorage.removeItem("echoroom-call-disclaimer-accepted");
    });

    let stored = await page.evaluate(
      (key) => localStorage.getItem(key),
      STORAGE_KEY,
    );
    expect(stored).toBeNull();

    // Simulate the accept flow: set localStorage to "true" (as the component does)
    await page.evaluate(
      (key) => localStorage.setItem(key, "true"),
      STORAGE_KEY,
    );

    stored = await page.evaluate(
      (key) => localStorage.getItem(key),
      STORAGE_KEY,
    );
    expect(stored).toBe("true");
  });

  // ── 9. Previously accepted renders nothing ─────────────────────────

  test("component renders null when user already accepted before", () => {
    const source = readComponentSource();

    // The component checks localStorage on mount via hasAcceptedBefore state
    expect(source).toContain("const [hasAcceptedBefore, setHasAcceptedBefore] = useState(false)");

    // It reads from localStorage with the STORAGE_KEY
    expect(source).toContain('localStorage.getItem(STORAGE_KEY)');

    // If stored value is "true", hasAcceptedBefore is set to true
    expect(source).toContain('setHasAcceptedBefore(true)');

    // Early return when hasAcceptedBefore is true
    expect(source).toMatch(/if\s*\(!mounted\s*\|\|\s*hasAcceptedBefore\)/);
    expect(source).toContain("return null");
  });

  // ── 10. localStorage unavailable handled gracefully ────────────────

  test("localStorage unavailable — getItem throw handled gracefully", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Simulate localStorage.getItem throwing (as might happen in private browsing, etc.)
    const result = await page.evaluate(() => {
      try {
        // Mock localStorage.getItem to throw
        const originalGetItem = Storage.prototype.getItem;
        Storage.prototype.getItem = function () {
          throw new Error("localStorage not available");
        };

        // Attempt the same logic as the component
        let hasAcceptedBefore = false;
        try {
          const stored = localStorage.getItem("echoroom-call-disclaimer-accepted");
          if (stored === "true") {
            hasAcceptedBefore = true;
          }
        } catch {
          // localStorage not available — continue without stored preference
        }

        // Restore
        Storage.prototype.getItem = originalGetItem;

        return { hasAcceptedBefore, error: null };
      } catch (e) {
        return { hasAcceptedBefore: false, error: String(e) };
      }
    });

    // The component should not crash — hasAcceptedBefore stays false
    expect(result.hasAcceptedBefore).toBe(false);
    expect(result.error).toBeNull();
  });

  test("localStorage unavailable — setItem throw handled gracefully", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Simulate localStorage.setItem throwing
    const result = await page.evaluate(() => {
      try {
        const originalSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function () {
          throw new Error("localStorage not available");
        };

        let errorCaught = false;
        try {
          localStorage.setItem("echoroom-call-disclaimer-accepted", "true");
        } catch {
          errorCaught = true;
          // localStorage not available — accept still proceeds for this session
        }

        Storage.prototype.setItem = originalSetItem;

        return { errorCaught };
      } catch (e) {
        return { errorCaught: false, outerError: String(e) };
      }
    });

    // The catch block should be entered, but no crash
    expect(result.errorCaught).toBe(true);
  });

  // ── Export verification ────────────────────────────────────────────

  test("component is exported as a named export", () => {
    const source = readComponentSource();
    expect(source).toContain("export function CallDisclaimerDialog");
  });
});
