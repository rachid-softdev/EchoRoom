import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test("should load the login page successfully", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Connexion" }),
    ).toBeVisible();
    await expect(
      page.getByText("Connectez-vous pour accéder à votre dashboard"),
    ).toBeVisible();
  });

  test("should display the email input field", async ({ page }) => {
    await page.goto("/login");
    const emailInput = page.getByLabel("Email");
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute("type", "email");
    await expect(emailInput).toHaveAttribute("required", "");
  });

  test("should display the password input field", async ({ page }) => {
    await page.goto("/login");
    const passwordInput = page.locator("#password");
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute("type", "password");
    await expect(passwordInput).toHaveAttribute("required", "");
  });

  test("should display the submit button", async ({ page }) => {
    await page.goto("/login");
    const submitButton = page.getByRole("button", { name: "Se connecter" });
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();
  });

  test("should show the forgot password link", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("link", { name: "Mot de passe oublié ?" }),
    ).toBeVisible();
  });

  test("should display the registration link", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("link", { name: /S'inscrire/ }),
    ).toBeVisible();
  });

  test("should navigate to register page when clicking inscription link", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /S'inscrire/ }).click();
    await expect(page).toHaveURL(/\/register/);
  });

  test("should display the EchoRoom branding on the login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("EchoRoom")).toBeVisible();
  });

  test("should show browser validation when submitting empty form", async ({ page }) => {
    await page.goto("/login");
    const submitButton = page.getByRole("button", { name: "Se connecter" });

    // Click submit with empty fields — the browser should prevent submission
    // due to the `required` attribute on email and password inputs
    await submitButton.click();

    // We should still be on the login page (form was not submitted)
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "Connexion" }),
    ).toBeVisible();
  });

  test("should show an error message after submitting invalid credentials", async ({ page }) => {
    await page.goto("/login");

    // Fill in fields with invalid credentials
    await page.getByLabel("Email").fill("invalid@example.com");
    await page.locator("#password").fill("wrongpassword");
    await page.getByRole("button", { name: "Se connecter" }).click();

    // The sign-in attempt will fail and show an error message
    await expect(
      page.getByText("Email ou mot de passe incorrect"),
    ).toBeVisible({ timeout: 10000 });
  });
});
