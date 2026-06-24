import { test, expect } from "@playwright/test";

test.describe("Register page", () => {
  test("should load the register page with heading", async ({ page }) => {
    await page.goto("/register");
    await expect(
      page.getByRole("heading", { name: "Créer un compte" }),
    ).toBeVisible();
    await expect(
      page.getByText("5 crédits offerts pour commencer"),
    ).toBeVisible();
  });

  test("should display email, username and password fields with correct attributes", async ({ page }) => {
    await page.goto("/register");

    const emailInput = page.getByLabel("Email");
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute("type", "email");
    await expect(emailInput).toHaveAttribute("required", "");

    const usernameInput = page.getByLabel("Nom d'utilisateur");
    await expect(usernameInput).toBeVisible();
    await expect(usernameInput).toHaveAttribute("type", "text");
    await expect(usernameInput).toHaveAttribute("required", "");
    await expect(usernameInput).toHaveAttribute("minlength", "3");

    const passwordInput = page.locator("#password");
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute("type", "password");
    await expect(passwordInput).toHaveAttribute("required", "");
    await expect(passwordInput).toHaveAttribute("minlength", "8");
  });

  test("should display links to terms and privacy pages", async ({ page }) => {
    await page.goto("/register");
    await expect(
      page.getByRole("link", { name: "conditions d'utilisation" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "politique de confidentialité" }),
    ).toBeVisible();
  });

  test("should navigate to terms page when clicking conditions link", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("link", { name: "conditions d'utilisation" }).click();
    await expect(page).toHaveURL(/\/terms/);
  });

  test("should navigate to privacy page when clicking politique link", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("link", { name: "politique de confidentialité" }).click();
    await expect(page).toHaveURL(/\/privacy/);
  });

  test("should show browser validation when submitting empty form", async ({ page }) => {
    await page.goto("/register");
    const submitButton = page.getByRole("button", { name: "Créer mon compte" });

    // Click submit with empty fields — the browser should prevent submission
    // due to the `required` attribute on email, username and password inputs
    await submitButton.click();

    // We should still be on the register page (form was not submitted)
    await expect(page).toHaveURL(/\/register/);
    await expect(
      page.getByRole("heading", { name: "Créer un compte" }),
    ).toBeVisible();
  });

  test("should navigate to login page via 'Déjà un compte' link", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("link", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "Connexion" }),
    ).toBeVisible();
  });
});
