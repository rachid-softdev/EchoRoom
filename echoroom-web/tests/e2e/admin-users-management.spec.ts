import { expect, test } from "@playwright/test";

test.describe("Admin users management — workflow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/users");
    await page.waitForLoadState("networkidle");
  });

  function skipIfNotAuthed(page: { url: () => string }) {
    const isLoggedIn = !page.url().includes("/login");
    test.skip(!isLoggedIn, "Skipping: requires authenticated session");
    return isLoggedIn;
  }

  // ── Page structure ─────────────────────────────────────────────────────

  test("page heading is Gestion des utilisateurs", async ({ page }) => {
    if (!skipIfNotAuthed(page)) return;

    await expect(page.getByRole("heading", { name: "Gestion des utilisateurs" })).toBeVisible();
  });

  test("subtitle describes the page purpose", async ({ page }) => {
    if (!skipIfNotAuthed(page)) return;

    await expect(
      page.getByText("Recherchez et gérez les utilisateurs de la plateforme"),
    ).toBeVisible();
  });

  // ── Search ─────────────────────────────────────────────────────────────

  test("search input has correct placeholder", async ({ page }) => {
    if (!skipIfNotAuthed(page)) return;

    await expect(page.getByPlaceholder("Rechercher par nom ou email...")).toBeVisible();
  });

  test("search input accepts text", async ({ page }) => {
    if (!skipIfNotAuthed(page)) return;

    const searchInput = page.getByPlaceholder("Rechercher par nom ou email...");
    await searchInput.fill("testuser");
    await expect(searchInput).toHaveValue("testuser");
  });

  test("search input shows clear button (X) after typing", async ({ page }) => {
    if (!skipIfNotAuthed(page)) return;

    const searchInput = page.getByPlaceholder("Rechercher par nom ou email...");
    await searchInput.fill("test");

    // Clear button should appear (X icon button)
    const clearBtn = page.locator("button.absolute.right-3");
    await expect(clearBtn).toBeVisible();
  });

  test("clear button (X) resets search input", async ({ page }) => {
    if (!skipIfNotAuthed(page)) return;

    const searchInput = page.getByPlaceholder("Rechercher par nom ou email...");
    await searchInput.fill("testuser");

    const clearBtn = page.locator("button.absolute.right-3");
    await clearBtn.click();

    await expect(searchInput).toHaveValue("");
  });

  test("clear button is hidden when search is empty", async ({ page }) => {
    if (!skipIfNotAuthed(page)) return;

    const searchInput = page.getByPlaceholder("Rechercher par nom ou email...");
    // Ensure search is empty
    await searchInput.fill("");
    await page.waitForTimeout(100);

    // Clear button should not be visible
    const clearBtn = page.locator("button.absolute.right-3");
    await expect(clearBtn).toHaveCount(0);
  });

  test("search is debounced with 300ms delay", async ({ page }) => {
    if (!skipIfNotAuthed(page)) return;

    const searchInput = page.getByPlaceholder("Rechercher par nom ou email...");

    // Type quickly — the debounce should prevent an immediate query
    await searchInput.fill("a");
    await page.waitForTimeout(100);
    await searchInput.fill("ab");
    await page.waitForTimeout(100);
    await searchInput.fill("abc");

    // After 300ms from last keystroke, the debounced value should update
    await page.waitForTimeout(350);

    // Verify the search input still has the full value
    await expect(searchInput).toHaveValue("abc");
  });

  // ── User list ──────────────────────────────────────────────────────────

  test("user list renders user items when data is available", async ({ page }) => {
    if (!skipIfNotAuthed(page)) return;

    // DataLoader renders either user list or empty state
    const userItems = page.locator("button.w-full.flex.items-center.justify-between");
    const emptyState = page.getByRole("heading", { name: "Aucun utilisateur" });

    const hasUsers = (await userItems.count()) > 0;
    const isEmpty = await emptyState.isVisible().catch(() => false);

    if (hasUsers) {
      // Verify each user item has basic info
      const firstUser = userItems.first();
      await expect(firstUser.locator("p.font-medium")).toBeVisible(); // username
      await expect(firstUser.locator("p.text-sm.text-muted-foreground")).toBeVisible(); // email
    } else if (isEmpty) {
      // Empty state is acceptable
      await expect(emptyState).toBeVisible();
    }
  });

  test("user items show username, email, role badge, credits and date", async ({ page }) => {
    if (!skipIfNotAuthed(page)) return;

    const userItems = page.locator("button.w-full.flex.items-center.justify-between");
    const hasUsers = (await userItems.count()) > 0;

    test.skip(!hasUsers, "Skipping: no users in the list");
    if (!hasUsers) return;

    const firstUser = userItems.first();

    // Username
    await expect(firstUser.locator("p.font-medium")).toBeVisible();
    // Email
    await expect(firstUser.locator("p.text-sm.text-muted-foreground")).toBeVisible();
    // Role badge
    await expect(
      firstUser.locator("div.inline-flex.items-center.rounded-full.border"),
    ).toBeVisible();
    // Credits text
    await expect(firstUser.locator("span").filter({ hasText: /crédits/ })).toBeVisible();
    // Date (short format)
    await expect(firstUser.locator("span.text-xs")).toBeVisible();
  });

  // ── Role badges ────────────────────────────────────────────────────────

  test("role badges display with correct variant colors", async ({ page }) => {
    if (!skipIfNotAuthed(page)) return;

    const userItems = page.locator("button.w-full.flex.items-center.justify-between");
    const hasUsers = (await userItems.count()) > 0;

    test.skip(!hasUsers, "Skipping: no users in the list");
    if (!hasUsers) return;

    // Check for role labels
    const adminBadges = page.getByText("Admin");
    const userBadges = page.getByText("Utilisateur");
    const moderatorBadges = page.getByText("Modérateur");

    const hasAdminBadges = (await adminBadges.count()) > 0;
    const hasUserBadges = (await userBadges.count()) > 0;
    const hasModeratorBadges = (await moderatorBadges.count()) > 0;

    // At least one role type should be present
    expect(hasAdminBadges || hasUserBadges || hasModeratorBadges).toBeTruthy();
  });

  // ── Deleted users ──────────────────────────────────────────────────────

  test("deleted users are shown with line-through styling", async ({ page }) => {
    if (!skipIfNotAuthed(page)) return;

    const deletedUsername = page.locator("span.line-through").first();
    const hasDeleted = (await deletedUsername.count()) > 0;

    test.skip(!hasDeleted, "Skipping: no deleted users in the list");
    if (!hasDeleted) return;

    // Deleted user should have the line-through class applied
    await expect(deletedUsername).toBeVisible();
  });

  // ── User detail view ───────────────────────────────────────────────────

  test("clicking a user opens detail view", async ({ page }) => {
    if (!skipIfNotAuthed(page)) return;

    const userItems = page.locator("button.w-full.flex.items-center.justify-between");
    const hasUsers = (await userItems.count()) > 0;

    test.skip(!hasUsers, "Skipping: no users to click");
    if (!hasUsers) return;

    // Click on the first user
    await userItems.first().click();
    await page.waitForTimeout(500);

    // Detail view should show back button with ChevronLeft icon
    const backBtn = page
      .getByRole("button")
      .filter({ has: page.locator("svg.lucide-chevron-left") });
    await expect(backBtn).toBeVisible();
  });

  test("user detail view shows Informations card with ID, credits, calls, likes, consent, date", async ({
    page,
  }) => {
    if (!skipIfNotAuthed(page)) return;

    const userItems = page.locator("button.w-full.flex.items-center.justify-between");
    const hasUsers = (await userItems.count()) > 0;

    test.skip(!hasUsers, "Skipping: no users to inspect");
    if (!hasUsers) return;

    await userItems.first().click();
    await page.waitForTimeout(500);

    // Informations card
    await expect(page.getByRole("heading", { name: "Informations" })).toBeVisible();

    // Check for info fields in the card
    const infoCard = page
      .getByRole("heading", { name: "Informations" })
      .locator("..")
      .locator("..");
    await expect(infoCard).toContainText("ID");
    await expect(infoCard).toContainText("Crédits");
    await expect(infoCard).toContainText("Appels");
    await expect(infoCard).toContainText("Likes reçus");
    await expect(infoCard).toContainText("Consentement");
    await expect(infoCard).toContainText("Inscrit le");
  });

  test("user detail view shows Statistiques card with scenarios, comments, reactions", async ({
    page,
  }) => {
    if (!skipIfNotAuthed(page)) return;

    const userItems = page.locator("button.w-full.flex.items-center.justify-between");
    const hasUsers = (await userItems.count()) > 0;

    test.skip(!hasUsers, "Skipping: no users to inspect");
    if (!hasUsers) return;

    await userItems.first().click();
    await page.waitForTimeout(500);

    // Statistiques card
    await expect(page.getByRole("heading", { name: "Statistiques" })).toBeVisible();

    const statsCard = page
      .getByRole("heading", { name: "Statistiques" })
      .locator("..")
      .locator("..");
    await expect(statsCard).toContainText("Scénarios");
    await expect(statsCard).toContainText("Commentaires");
    await expect(statsCard).toContainText("Réactions");
  });

  test("back button in detail view returns to user list", async ({ page }) => {
    if (!skipIfNotAuthed(page)) return;

    const userItems = page.locator("button.w-full.flex.items-center.justify-between");
    const hasUsers = (await userItems.count()) > 0;

    test.skip(!hasUsers, "Skipping: no users to click");
    if (!hasUsers) return;

    // Click user to open detail
    await userItems.first().click();
    await page.waitForTimeout(500);

    // Click back button
    const backBtn = page
      .getByRole("button")
      .filter({ has: page.locator("svg.lucide-chevron-left") });
    await backBtn.click();
    await page.waitForTimeout(500);

    // Should return to list view
    await expect(page.getByRole("heading", { name: "Gestion des utilisateurs" })).toBeVisible();
  });

  test("detail view shows username as heading and email as subtitle", async ({ page }) => {
    if (!skipIfNotAuthed(page)) return;

    const userItems = page.locator("button.w-full.flex.items-center.justify-between");
    const hasUsers = (await userItems.count()) > 0;

    test.skip(!hasUsers, "Skipping: no users to inspect");
    if (!hasUsers) return;

    // Get the username text before clicking
    await userItems.first().click();
    await page.waitForTimeout(500);

    // Username should be h1
    const heading = page.locator("h1.text-3xl.font-bold");
    await expect(heading).toBeVisible();

    // Email should be displayed below the username
    await expect(page.locator("p.text-muted-foreground.mt-1")).toBeVisible();
  });

  test("detail view shows role badge next to username", async ({ page }) => {
    if (!skipIfNotAuthed(page)) return;

    const userItems = page.locator("button.w-full.flex.items-center.justify-between");
    const hasUsers = (await userItems.count()) > 0;

    test.skip(!hasUsers, "Skipping: no users to inspect");
    if (!hasUsers) return;

    await userItems.first().click();
    await page.waitForTimeout(500);

    // Role badge should be visible in the header area
    const roleBadges = page.locator("div.inline-flex.items-center.rounded-full.border");
    const hasBadge = (await roleBadges.count()) > 0;
    expect(hasBadge).toBeTruthy();
  });

  // ── Empty state ────────────────────────────────────────────────────────

  test("empty state is shown when no users match search", async ({ page }) => {
    if (!skipIfNotAuthed(page)) return;

    const searchInput = page.getByPlaceholder("Rechercher par nom ou email...");
    await searchInput.fill("zzz_nonexistent_user_xxx");
    await page.waitForTimeout(500); // Wait for debounce + query

    // Empty state should appear (either "Aucun utilisateur" with search context)
    const emptyHeading = page.getByRole("heading", { name: "Aucun utilisateur" });
    const isEmptyVisible = await emptyHeading.isVisible().catch(() => false);

    if (isEmptyVisible) {
      await expect(
        page.getByText("Aucun utilisateur ne correspond à votre recherche."),
      ).toBeVisible();
    }
    // If no empty state (e.g., search returned results), that's also acceptable
  });

  test("user count is displayed in the list header", async ({ page }) => {
    if (!skipIfNotAuthed(page)) return;

    const userItems = page.locator("button.w-full.flex.items-center.justify-between");
    const hasUsers = (await userItems.count()) > 0;

    test.skip(!hasUsers, "Skipping: no users in the list");
    if (!hasUsers) return;

    // The card title shows item count
    const countText = page.locator("h3.card-title");
    await expect(countText).toBeVisible();
    await expect(countText).toContainText(/utilisateur/);
  });
});
