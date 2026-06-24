import { test, expect } from "@playwright/test";
import path from "path";

// ── Helpers ──

/**
 * Mock the session endpoint with authenticated user data.
 */
async function mockSession(page: import("@playwright/test").Page, overrides?: Record<string, unknown>) {
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "test-user-id",
          name: "Test User",
          email: "test@example.com",
          username: "testuser",
          role: "USER",
          credits: 100,
          ...overrides,
        },
        expires: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    });
  });
}

/**
 * Mock the tRPC profile.updateProfile mutation.
 */
async function mockUpdateProfile(page: import("@playwright/test").Page) {
  await page.route("**/api/trpc/profile.updateProfile*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { result: { data: { json: { success: true } } } },
      ]),
    });
  });
}

/**
 * Mock the tRPC auth.changePassword mutation.
 */
async function mockChangePassword(
  page: import("@playwright/test").Page,
  options?: { shouldFail?: boolean; errorMessage?: string },
) {
  await page.route("**/api/trpc/auth.changePassword*", async (route) => {
    if (options?.shouldFail) {
      // Simulate a tRPC error response
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            result: {
              data: {
                json: {
                  error: {
                    message: options.errorMessage ?? "Mot de passe actuel incorrect",
                  },
                },
              },
            },
          },
        ]),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { result: { data: { json: { success: true } } } },
        ]),
      });
    }
  });
}

// ── Source analysis for P3 (Settings button enable/disable) ──

test.describe("P3 — Settings save button enable/disable", () => {
  const SETTINGS_PATH = path.resolve(
    __dirname,
    "../../src/app/(dashboard)/settings/SettingsPageClient.tsx",
  );

  function readSettingsSource(): string {
    return require("fs").readFileSync(SETTINGS_PATH, "utf-8");
  }

  test("source: hasChanges tracks username vs originalUsername", () => {
    const source = readSettingsSource();
    // The fix: `setHasChanges(newValue !== originalUsername.current)`
    // triggers re-render and disables the button when username == original
    expect(source).toContain("setHasChanges(newValue !== originalUsername.current)");
  });

  test("source: save button is disabled when !hasChanges", () => {
    const source = readSettingsSource();
    // Button's disabled prop includes !hasChanges
    expect(source).toContain("disabled={!hasChanges");
  });

  test("source: originalUsername is stored in a ref on mount", () => {
    const source = readSettingsSource();
    // The original username is persisted via useRef for comparison
    expect(source).toContain("originalUsername.current");
    expect(source).toContain("useRef");
  });

  // ── Live/mock E2E tests (P3) ──

  test("mock: save button is disabled by default (no changes)", async ({ page }) => {
    await mockSession(page);
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/settings");
    test.skip(redirected, "Authentication required to access settings page");
    if (redirected) return;

    // The save button should be disabled when username hasn't changed
    const saveButton = page.getByRole("button", { name: "Enregistrer" });
    await expect(saveButton).toBeDisabled();
  });

  test("mock: changing username enables the save button", async ({ page }) => {
    await mockSession(page);
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/settings");
    test.skip(redirected, "Authentication required to access settings page");
    if (redirected) return;

    const saveButton = page.getByRole("button", { name: "Enregistrer" });
    await expect(saveButton).toBeDisabled();

    // Change the username
    const usernameInput = page.locator("#username");
    await usernameInput.fill("newusername");

    // Button should now be enabled
    await expect(saveButton).toBeEnabled();
  });

  test("mock: reverting username to original disables the save button", async ({ page }) => {
    await mockSession(page, { username: "testuser" });
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/settings");
    test.skip(redirected, "Authentication required to access settings page");
    if (redirected) return;

    const saveButton = page.getByRole("button", { name: "Enregistrer" });
    const usernameInput = page.locator("#username");

    // Step 1: Verify button starts disabled
    await expect(saveButton).toBeDisabled();

    // Step 2: Change username → button enables
    await usernameInput.fill("differentuser");
    await expect(saveButton).toBeEnabled();

    // Step 3: Revert to original username → button disables again
    await usernameInput.fill("testuser");
    await expect(saveButton).toBeDisabled();
  });

  test("mock: saving the profile calls the mutation and disables button", async ({ page }) => {
    await mockSession(page);
    await mockUpdateProfile(page);
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/settings");
    test.skip(redirected, "Authentication required to access settings page");
    if (redirected) return;

    // Change username
    const usernameInput = page.locator("#username");
    await usernameInput.fill("brandnewuser");

    const saveButton = page.getByRole("button", { name: "Enregistrer" });
    await expect(saveButton).toBeEnabled();

    // Click save
    await saveButton.click();

    // After mutation success, hasChanges is set to false → button disabled
    await expect(saveButton).toBeDisabled({ timeout: 5000 });

    // Verify the username is still the new value in the input
    await expect(usernameInput).toHaveValue("brandnewuser");
  });

  test("mock: multiple changes toggle button state correctly", async ({ page }) => {
    await mockSession(page, { username: "originalname" });
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/settings");
    test.skip(redirected, "Authentication required to access settings page");
    if (redirected) return;

    const saveButton = page.getByRole("button", { name: "Enregistrer" });
    const usernameInput = page.locator("#username");

    // Change 1→2→3→back to 1, button should track correctly
    await usernameInput.fill("name1");
    await expect(saveButton).toBeEnabled();

    await usernameInput.fill("name2");
    await expect(saveButton).toBeEnabled();

    await usernameInput.fill("name3");
    await expect(saveButton).toBeEnabled();

    await usernameInput.fill("originalname");
    await expect(saveButton).toBeDisabled();
  });
});

// ── P8: Password change feature ──

test.describe("P8 — Password change in Settings", () => {
  const SETTINGS_PATH = path.resolve(
    __dirname,
    "../../src/app/(dashboard)/settings/SettingsPageClient.tsx",
  );

  function readSettingsSource(): string {
    return require("fs").readFileSync(SETTINGS_PATH, "utf-8");
  }

  test("source: password change section is present", () => {
    const source = readSettingsSource();
    // The password change card has a Lock icon and "Mot de passe" title
    expect(source).toContain("Mot de passe");
    expect(source).toContain("Lock");
    expect(source).toContain("Changez votre mot de passe");
  });

  test("source: password fields exist: currentPassword, newPassword, confirmPassword", () => {
    const source = readSettingsSource();
    // All three password input fields must be defined
    expect(source).toContain("currentPassword");
    expect(source).toContain("newPassword");
    expect(source).toContain("confirmPassword");
  });

  test("source: change password button validates confirmPassword === newPassword", () => {
    const source = readSettingsSource();
    // The button's disabled attribute checks password match
    expect(source).toContain("newPassword !== confirmPassword");
  });

  test("source: change password button validates minimum length (8)", () => {
    const source = readSettingsSource();
    // The button's disabled attribute checks password length
    expect(source).toContain("newPassword.length < 8");
  });

  test("source: change password button disabled when fields are empty", () => {
    const source = readSettingsSource();
    // The button is disabled when any field is empty
    expect(source).toContain("!currentPassword || !newPassword || !confirmPassword");
  });

  test("source: change password uses api.auth.changePassword mutation", () => {
    const source = readSettingsSource();
    expect(source).toContain("api.auth.changePassword.useMutation");
  });

  // ── Live/mock E2E tests (P8) ──

  test("mock: password change form is visible on settings page", async ({ page }) => {
    await mockSession(page);
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/settings");
    test.skip(redirected, "Authentication required to access settings page");
    if (redirected) return;

    // The "Mot de passe" card section should be visible
    await expect(page.getByText("Mot de passe").first()).toBeVisible();
    await expect(page.getByText("Changez votre mot de passe")).toBeVisible();

    // All three password fields should be present
    await expect(page.locator("#currentPassword")).toBeVisible();
    await expect(page.locator("#newPassword")).toBeVisible();
    await expect(page.locator("#confirmPassword")).toBeVisible();
  });

  test("mock: change password button is disabled when fields are empty", async ({ page }) => {
    await mockSession(page);
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/settings");
    test.skip(redirected, "Authentication required to access settings page");
    if (redirected) return;

    const changeButton = page.getByRole("button", { name: "Changer le mot de passe" });
    await expect(changeButton).toBeDisabled();
  });

  test("mock: change password button disabled when confirmPassword does not match newPassword", async ({ page }) => {
    await mockSession(page);
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/settings");
    test.skip(redirected, "Authentication required to access settings page");
    if (redirected) return;

    const changeButton = page.getByRole("button", { name: "Changer le mot de passe" });
    await expect(changeButton).toBeDisabled();

    // Fill current password
    await page.locator("#currentPassword").fill("OldPass123!");
    // Fill new password
    await page.locator("#newPassword").fill("NewPass456!");
    // Fill confirm with DIFFERENT password
    await page.locator("#confirmPassword").fill("DifferentPass!");

    // Button should STILL be disabled (mismatch)
    await expect(changeButton).toBeDisabled();
  });

  test("mock: change password button disabled when newPassword is too short (< 8 chars)", async ({ page }) => {
    await mockSession(page);
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/settings");
    test.skip(redirected, "Authentication required to access settings page");
    if (redirected) return;

    const changeButton = page.getByRole("button", { name: "Changer le mot de passe" });
    const currentPwd = page.locator("#currentPassword");
    const newPwd = page.locator("#newPassword");
    const confirmPwd = page.locator("#confirmPassword");

    // Fill with short password (exactly 7 chars)
    await currentPwd.fill("OldPass123!");
    await newPwd.fill("Short1!");
    await confirmPwd.fill("Short1!");

    // Button should be disabled (length < 8)
    await expect(changeButton).toBeDisabled();
  });

  test("mock: change password button enabled when validation passes", async ({ page }) => {
    await mockSession(page);
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/settings");
    test.skip(redirected, "Authentication required to access settings page");
    if (redirected) return;

    const changeButton = page.getByRole("button", { name: "Changer le mot de passe" });

    // Fill all fields correctly
    await page.locator("#currentPassword").fill("OldPass123!");
    await page.locator("#newPassword").fill("NewValidPass789!");
    await page.locator("#confirmPassword").fill("NewValidPass789!");

    // Button should be enabled (all validation passes)
    await expect(changeButton).toBeEnabled();
  });

  test("mock: successful password change clears all fields", async ({ page }) => {
    await mockSession(page);
    await mockChangePassword(page);
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const redirected = !page.url().includes("/settings");
    test.skip(redirected, "Authentication required to access settings page");
    if (redirected) return;

    const changeButton = page.getByRole("button", { name: "Changer le mot de passe" });
    const currentPwd = page.locator("#currentPassword");
    const newPwd = page.locator("#newPassword");
    const confirmPwd = page.locator("#confirmPassword");

    // Fill all fields correctly
    await currentPwd.fill("OldPass123!");
    await newPwd.fill("NewValidPass789!");
    await confirmPwd.fill("NewValidPass789!");

    await expect(changeButton).toBeEnabled();

    // Click the change button
    await changeButton.click();

    // After successful change, all fields should be cleared
    await expect(currentPwd).toHaveValue("", { timeout: 5000 });
    await expect(newPwd).toHaveValue("");
    await expect(confirmPwd).toHaveValue("");

    // Button should be disabled again (fields empty)
    await expect(changeButton).toBeDisabled();
  });
});
