import { expect, test } from "@playwright/test";

test.describe("Error pages", () => {
  test("should show 404 page when navigating to a non-existent route", async ({ page }) => {
    await page.goto("/non-existent-route", {
      waitUntil: "networkidle",
    });
    await expect(page.getByText("404")).toBeVisible();
    await expect(page.getByText(/Oops/)).toBeVisible();
  });

  test("should display 'Retour à l'accueil' button on the 404 page", async ({ page }) => {
    await page.goto("/non-existent-route", {
      waitUntil: "networkidle",
    });
    await expect(page.getByRole("button", { name: /Retour à l'accueil/ })).toBeVisible();
  });

  test("should navigate to the home page when clicking 'Retour à l'accueil' on 404", async ({
    page,
  }) => {
    await page.goto("/non-existent-route", {
      waitUntil: "networkidle",
    });
    await page.getByRole("button", { name: /Retour à l'accueil/ }).click();
    await expect(page).toHaveURL("/");
  });

  test("should show 404 page for a non-existent scenario route", async ({ page }) => {
    // The scenario/[id] server-side page calls notFound() for missing scenarios
    await page.goto("/scenario/non-existent-scenario-id-00000", {
      waitUntil: "networkidle",
    });
    await expect(page.getByText("404")).toBeVisible();
    await expect(page.getByText(/Oops/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Retour à l'accueil/ })).toBeVisible();
  });

  test("should show 404 page for an empty scenario ID segment", async ({ page }) => {
    await page.goto("/scenario/", { waitUntil: "networkidle" });
    await expect(page.getByText("404")).toBeVisible();
  });
});
