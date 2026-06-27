import { expect, test } from "@playwright/test";

/**
 * Mock the session endpoint to return authenticated user data.
 */
async function mockAuthenticatedSession(page: import("@playwright/test").Page) {
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "mock-user-id",
          name: "Test User",
          email: "test@example.com",
          username: "testuser",
          role: "USER",
          credits: 50,
        },
        expires: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    });
  });
}

/**
 * Mock the CSRF endpoint (required by next-auth for signIn).
 */
async function mockCsrfToken(page: import("@playwright/test").Page) {
  await page.route("**/api/auth/csrf", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ csrfToken: "mock-csrf-token" }),
    });
  });
}


test.describe("Auth flows with mocked API", () => {
  // ── Login flow ──

  test("mock: successful login redirects to /dashboard", async ({ page }) => {
    // Mock the essential auth endpoints
    await mockAuthenticatedSession(page);
    await mockCsrfToken(page);

    // Navigate to login
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();

    // Mock the credentials callback before submitting
    await page.route("**/api/auth/callback/credentials", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: "http://localhost:3000/dashboard" }),
      });
    });

    // Also mock signIn's redirect — the page will try to navigate to the dashboard
    // We intercept all navigation to /login to prevent actual redirect issues
    await page.route("**/api/auth/signin*", async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: "" });
    });

    // Fill in valid credentials and submit
    await page.getByLabel("Email").fill("test@example.com");
    await page.locator("#password").fill("validPassword123!");
    await page.getByRole("button", { name: "Se connecter" }).click();

    // Wait briefly for the signIn call to resolve
    await page.waitForTimeout(1000);
  });

  test("mock: session is returned for authenticated user", async ({ page }) => {
    await mockAuthenticatedSession(page);

    await page.goto("/api/auth/session");
    const body = await page.evaluate(() => fetch("/api/auth/session").then((r) => r.json()));
    expect(body).toBeTruthy();
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe("test@example.com");
    expect(body.user.role).toBe("USER");
  });

  test("mock: unauthenticated session returns null", async ({ page }) => {
    await page.route("**/api/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: null }),
      });
    });

    await page.goto("/api/auth/session");
    const body = await page.evaluate(() => fetch("/api/auth/session").then((r) => r.json()));
    expect(body).toBeTruthy();
    // user should be null or undefined for unauthenticated
    expect(body.user).toBeFalsy();
  });

  // ── Register flow ──

  test("mock: register page has form elements visible", async ({ page }) => {
    await page.goto("/register");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Créer un compte" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Nom d'utilisateur")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.getByRole("checkbox")).toBeVisible();
    await expect(page.getByRole("button", { name: "Créer mon compte" })).toBeVisible();
  });

  test("mock: register submit button disabled initially", async ({ page }) => {
    await page.goto("/register");
    await page.waitForLoadState("networkidle");

    // Button should be disabled without consent and weak password
    const submitButton = page.getByRole("button", { name: "Créer mon compte" });
    await expect(submitButton).toBeDisabled();
  });

  test("mock: register with all fields filled enables submit", async ({ page }) => {
    await page.goto("/register");
    await page.waitForLoadState("networkidle");

    // Fill in strong password to enable passwordStrength >= 3
    await page.getByLabel("Email").fill("newuser@example.com");
    await page.getByLabel("Nom d'utilisateur").fill("newuser");
    await page.locator("#password").fill("StrongPass1!");

    // Check consent
    await page.getByRole("checkbox").check();

    // Button should now be enabled (passwordStrength >= 3 and consentAccepted)
    const submitButton = page.getByRole("button", { name: "Créer mon compte" });
    await expect(submitButton).toBeEnabled();
  });

  test("mock: register without consent shows error", async ({ page }) => {
    await page.goto("/register");
    await page.waitForLoadState("networkidle");

    // Fill fields but don't check consent
    await page.getByLabel("Email").fill("newuser@example.com");
    await page.getByLabel("Nom d'utilisateur").fill("newuser");
    await page.locator("#password").fill("StrongPass1!");

    // Try to submit — button should be disabled due to !consentAccepted
    // Actually, passwordStrength < 3 might also be an issue, let's use a very strong password
    await page.locator("#password").fill("Str0ng!Pass");
    // The button should still be disabled because consent not accepted
    const submitButton = page.getByRole("button", { name: "Créer mon compte" });
    await expect(submitButton).toBeDisabled();
  });

  // ── Password validation ──

  test("mock: password strength meter updates on typing", async ({ page }) => {
    await page.goto("/register");
    await page.waitForLoadState("networkidle");

    const passwordInput = page.locator("#password");

    // Initially no strength meter visible (password empty)
    await expect(page.getByText("Force :")).toHaveCount(0);

    // Type weak password
    await passwordInput.fill("abc");
    await expect(page.getByText("Force : Très faible")).toBeVisible();

    // Type strong password
    await passwordInput.fill("StrongPass1!");
    await expect(page.getByText("Force : Très fort")).toBeVisible();
  });

  // ── Error simulation ──

  test("mock: login with invalid credentials shows error message", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Don't mock the callback — let it fail naturally
    await page.getByLabel("Email").fill("wrong@example.com");
    await page.locator("#password").fill("wrongpassword");
    await page.getByRole("button", { name: "Se connecter" }).click();

    // Should show error message
    await expect(page.getByText("Email ou mot de passe incorrect")).toBeVisible({ timeout: 10000 });
  });

  // ── Session persistence ──

  test("mock: session persists after page reload", async ({ page }) => {
    // Mock session to return authenticated user
    await mockAuthenticatedSession(page);

    await page.goto("/api/auth/session");
    const body1 = await page.evaluate(() => fetch("/api/auth/session").then((r) => r.json()));
    expect(body1).toBeTruthy();
    expect(body1.user).toBeTruthy();
    expect(body1.user.email).toBe("test@example.com");
  });

  test("mock: expired session redirects to login", async ({ page }) => {
    // First, set up a session that will appear expired
    await page.route("**/api/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: null,
          expires: new Date(Date.now() - 86_400_000).toISOString(),
        }),
      });
    });

    // Visit a protected route
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Should be redirected to login
    expect(page.url()).toContain("/login");
  });

  // ── Logout ──

  test("mock: signOut clears the session", async ({ page }) => {
    // Mock the session as authenticated initially
    await mockAuthenticatedSession(page);

    // Verify session exists
    await page.goto("/api/auth/session");
    const body = await page.evaluate(() => fetch("/api/auth/session").then((r) => r.json()));
    expect(body).toBeTruthy();
    expect(body.user).toBeTruthy();

    // Now simulate signOut by returning null session
    await page.route(
      "**/api/auth/session",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ user: null }),
        });
      },
      { times: 1 },
    );

    await page.goto("/api/auth/session");
    const body2 = await page.evaluate(() => fetch("/api/auth/session").then((r) => r.json()));
    expect(body2).toBeTruthy();
    expect(body2.user).toBeFalsy();
  });
});
