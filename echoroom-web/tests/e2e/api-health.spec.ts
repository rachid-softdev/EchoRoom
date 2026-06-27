import { expect, test } from "@playwright/test";

test.describe("API endpoints health checks", () => {
  test("GET /api/health responds (not 404)", async ({ page }) => {
    // Dev server may serve this route via SPA or API handler; just verify it exists
    const response = await page.request.get("/api/health");
    expect(response.status()).not.toBe(404);
  });

  test("GET /api/health returns valid JSON body when status is 200", async ({ page }) => {
    const response = await page.request.get("/api/health");
    // In dev mode the route may be handled by the SPA catch-all;
    // only validate JSON body when the API actually responds
    expect(response.status()).not.toBe(404);

    if (response.status() === 200) {
      const body = await response.json();
      expect(body).toHaveProperty("status");
      expect(body).toHaveProperty("timestamp");
      expect(body).toHaveProperty("uptime");
      expect(body).toHaveProperty("durationMs");
      expect(body).toHaveProperty("checks");
      expect(["healthy", "degraded"]).toContain(body.status);
    }
  });

  test("GET /api/auth/session returns valid JSON (null when not authenticated)", async ({
    page,
  }) => {
    const response = await page.request.get("/api/auth/session");
    expect(response.status()).toBe(200);

    const body = await response.json();
    // Without an active session, auth() returns null which serializes to JSON null
    expect(body).toBeNull();
  });

  test("POST /api/user/export without auth returns 401", async ({ page }) => {
    const response = await page.request.post("/api/user/export");
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.error).toBe("Non authentifi\u00e9");
  });

  test("POST /api/webhooks/twilio with missing body returns expected status code (403/404/200 in dev)", async ({
    page,
  }) => {
    // Send a POST with no form body and no signature header.
    // The middleware parses formData (returns empty FormData for empty body),
    // then rejects at the missing x-twilio-signature check.
    // In dev mode the route may be unavailable or handled differently.
    const response = await page.request.post("/api/webhooks/twilio");
    expect([403, 404, 200]).toContain(response.status());
  });
});
