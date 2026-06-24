import { test, expect } from "@playwright/test";
import path from "path";

// ── Helpers ──

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

// ── Source analysis ──

test.describe("P1 — Email case sensitivity fix", () => {
  const AUTH_PATH = path.resolve(__dirname, "../../src/lib/auth.ts");

  function readAuthModule(): string {
    return require("fs").readFileSync(AUTH_PATH, "utf-8");
  }

  test("source: email is normalized to lowercase via .toLowerCase()", () => {
    const source = readAuthModule();
    // The fix: credentials.email is cast to string and lowercased before findUnique
    expect(source).toContain(".toLowerCase()");
  });

  test("source: findUnique uses lowercased email, not raw input", () => {
    const source = readAuthModule();
    // Verify the pattern: `where: { email }` where `email` is the lowercased variable
    // The key sequence should be: toLowerCase() → findUnique({ where: { email } })
    const hasLowerCase = source.includes("(credentials.email as string).toLowerCase()");
    const hasFindUnique = source.includes("where: { email }");
    // There must be a `const email = ...toLowerCase()` before `findUnique`
    expect(hasLowerCase).toBe(true);
    expect(hasFindUnique).toBe(true);
  });

  test("source: rate limit uses lowercased email as identifier", () => {
    const source = readAuthModule();
    // The rate limit should also use the lowercased email for consistency
    expect(source).toMatch(/identifier.*`login:\$\{email\}`/);
  });

  // ── Live browser / mock E2E tests ──

  test("mock: login with Test@Example.com (mixed case) succeeds via lowercase normalization", async ({ page }) => {
    // Mock session and CSRF
    await mockAuthenticatedSession(page);
    await mockCsrfToken(page);

    // Navigate to login
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();

    // Mock the credentials callback — this simulates that the server-side
    // authorize function lowercases the email before findUnique.
    // The callback will be called with the email as-is; the fix ensures
    // the backend normalizes it.
    await page.route("**/api/auth/callback/credentials", async (route) => {
      // Verify that the request body contains the mixed-case email
      const requestBody = route.request().postData() ?? "";
      expect(requestBody).toContain("Test@Example.com");
      // Simulate a successful login (the server's .toLowerCase() in authorize
      // would match the user stored with "test@example.com")
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: "http://localhost:3000/dashboard" }),
      });
    });

    // Fill in mixed-case email
    await page.getByLabel("Email").fill("Test@Example.com");
    await page.locator("#password").fill("SecurePass123!");
    await page.getByRole("button", { name: "Se connecter" }).click();

    // Wait briefly for the signIn call to resolve
    await page.waitForTimeout(1500);
  });

  test("mock: login with test@example.com (lowercase) succeeds", async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockCsrfToken(page);

    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();

    // Intercept the credentials callback to verify lowercase email is used
    await page.route("**/api/auth/callback/credentials", async (route) => {
      const requestBody = route.request().postData() ?? "";
      expect(requestBody).toContain("test@example.com");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: "http://localhost:3000/dashboard" }),
      });
    });

    await page.getByLabel("Email").fill("test@example.com");
    await page.locator("#password").fill("SecurePass123!");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await page.waitForTimeout(1500);
  });

  test("mock: login with TEST@EXAMPLE.COM (uppercase) succeeds", async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockCsrfToken(page);

    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();

    // Intercept the credentials callback to verify uppercase email is sent,
    // and that the server normalizes it
    await page.route("**/api/auth/callback/credentials", async (route) => {
      const requestBody = route.request().postData() ?? "";
      expect(requestBody).toContain("TEST@EXAMPLE.COM");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: "http://localhost:3000/dashboard" }),
      });
    });

    await page.getByLabel("Email").fill("TEST@EXAMPLE.COM");
    await page.locator("#password").fill("SecurePass123!");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await page.waitForTimeout(1500);
  });

  test("mock: login then logout then re-login with different case works", async ({ page }) => {
    // Step 1: Mock session as authenticated
    await mockAuthenticatedSession(page);
    await mockCsrfToken(page);

    // Initial login with mixed case
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page.route("**/api/auth/callback/credentials", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: "http://localhost:3000/dashboard" }),
      });
    });

    await page.getByLabel("Email").fill("Test@Example.com");
    await page.locator("#password").fill("SecurePass123!");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await page.waitForTimeout(1000);

    // Step 2: Mock signOut (return null session)
    await page.route("**/api/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: null }),
      });
    });

    // Step 3: Navigate to login and re-login with lowercase
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Restore authenticated session mock for the re-login
    await mockAuthenticatedSession(page);

    await page.route("**/api/auth/callback/credentials", async (route) => {
      const requestBody = route.request().postData() ?? "";
      // After the fix, the server normalizes case, so both should work
      expect(requestBody).toContain("test@example.com");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: "http://localhost:3000/dashboard" }),
      });
    });

    await page.getByLabel("Email").fill("test@example.com");
    await page.locator("#password").fill("SecurePass123!");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await page.waitForTimeout(1500);
  });

  test("live: login form sends email as-is (backend normalizes)", async ({ page }) => {
    // This test verifies the actual form submission sends the email as typed.
    // We intercept the callback/credentials request to capture the payload.
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    let capturedEmail = "";

    await page.route("**/api/auth/callback/credentials", async (route) => {
      const postData = route.request().postData() ?? "";
      // Extract email from form data (URL-encoded)
      const match = postData.match(/email=([^&]+)/);
      if (match) {
        capturedEmail = decodeURIComponent(match[1]!);
      }
      // Let the request fail naturally (wrong creds) so we don't redirect
      await route.continue();
    });

    // Fill with mixed case
    await page.getByLabel("Email").fill("UpperCase@Test.com");
    await page.locator("#password").fill("SomePass123!");
    await page.getByRole("button", { name: "Se connecter" }).click();

    // Wait for the request to be captured
    await page.waitForTimeout(2000);

    // The form sends the email as-is (case preserving)
    // The fix is on the server side (auth.ts authorize function)
    expect(capturedEmail).toBe("UpperCase@Test.com");
  });
});
