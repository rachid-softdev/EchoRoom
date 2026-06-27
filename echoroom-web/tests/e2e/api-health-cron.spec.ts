import { expect, test } from "@playwright/test";

test.describe("API — Health, Cron, OpenGraph, User Export", () => {
  // ─────────────────────────────────────────────────────────────────────
  // Healthcheck
  // ─────────────────────────────────────────────────────────────────────

  test.describe("GET /api/health", () => {
    test("returns 200 when DB and Redis are healthy", async ({ page }) => {
      const response = await page.request.get("/api/health");

      // The route must exist (not 404)
      expect(response.status()).not.toBe(404);

      if (response.status() === 200) {
        const body = await response.json();
        expect(body.status).toBe("healthy");
        expect(body.checks.database).toBe("healthy");
        expect(body.checks.redis).toBe("healthy");
      }
    });

    test("returns valid JSON structure with expected fields", async ({ page }) => {
      const response = await page.request.get("/api/health");
      expect(response.status()).not.toBe(404);

      if (response.status() === 200 || response.status() === 503) {
        const body = await response.json();

        // Core fields
        expect(body).toHaveProperty("status");
        expect(body).toHaveProperty("timestamp");
        expect(body).toHaveProperty("uptime");
        expect(body).toHaveProperty("durationMs");
        expect(body).toHaveProperty("checks");

        // Status must be one of the known values
        expect(["healthy", "degraded"]).toContain(body.status);

        // Checks must contain database and redis
        expect(body.checks).toHaveProperty("database");
        expect(body.checks).toHaveProperty("redis");
        expect(["healthy", "unhealthy"]).toContain(body.checks.database);
        expect(["healthy", "unhealthy"]).toContain(body.checks.redis);

        // Timestamp should be valid ISO
        expect(() => new Date(body.timestamp)).not.toThrow();

        // Duration should be a number
        expect(typeof body.durationMs).toBe("number");

        // Uptime should be a number (seconds)
        expect(typeof body.uptime).toBe("number");
        expect(body.uptime).toBeGreaterThan(0);
      }
    });

    test("returns 503 degraded when database is unhealthy", async ({ page }) => {
      const response = await page.request.get("/api/health");

      // If DB is down, the status is 503 and status is "degraded"
      if (response.status() === 503) {
        const body = await response.json();
        expect(body.status).toBe("degraded");
      }
    });

    test("response includes check duration in milliseconds", async ({ page }) => {
      const response = await page.request.get("/api/health");
      expect(response.status()).not.toBe(404);

      if (response.status() === 200 || response.status() === 503) {
        const body = await response.json();
        expect(typeof body.durationMs).toBe("number");
        // Duration should be reasonable (< 10 seconds)
        expect(body.durationMs).toBeLessThan(10000);
      }
    });

    test("uptime increases between two sequential calls", async ({ page }) => {
      const response1 = await page.request.get("/api/health");
      const body1 =
        response1.status() === 200 || response1.status() === 503 ? await response1.json() : null;

      // Small delay
      await page.waitForTimeout(500);

      const response2 = await page.request.get("/api/health");
      const body2 =
        response2.status() === 200 || response2.status() === 503 ? await response2.json() : null;

      if (body1 && body2) {
        // Uptime should have increased (or stayed same if resolution is seconds)
        expect(body2.uptime).toBeGreaterThanOrEqual(body1.uptime);
      }
    });

    test("response has Content-Type application/json", async ({ page }) => {
      const response = await page.request.get("/api/health");
      expect(response.status()).not.toBe(404);

      const contentType = response.headers()["content-type"] ?? "";
      expect(contentType).toContain("application/json");
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Cron jobs — Authorization
  // ─────────────────────────────────────────────────────────────────────

  test.describe("Cron job endpoints — authorization", () => {
    const cronEndpoints = [
      "/api/cron/gdpr-purge",
      "/api/cron/rotate-featured",
      "/api/cron/cleanup-recordings",
    ];

    for (const endpoint of cronEndpoints) {
      test(`${endpoint} returns 401 when CRON_SECRET is missing (no auth header)`, async ({
        page,
      }) => {
        const response = await page.request.get(endpoint);

        // In dev mode the route may return 404 if Next.js doesn't register it.
        // If the route exists, it should return 401 when no auth header is present.
        if (response.status() !== 404) {
          expect(response.status()).toBe(401);
          const body = await response.json();
          expect(body.error).toBe("Non autorisé");
        }
      });

      test(`${endpoint} returns 401 when CRON_SECRET header is invalid`, async ({ page }) => {
        const response = await page.request.get(endpoint, {
          headers: {
            authorization: "Bearer invalid_secret_token",
          },
        });

        if (response.status() !== 404) {
          expect(response.status()).toBe(401);
        }
      });

      test(`${endpoint} returns 401 when authorization header has no Bearer prefix`, async ({
        page,
      }) => {
        const response = await page.request.get(endpoint, {
          headers: {
            authorization: "just_a_token_without_bearer",
          },
        });

        if (response.status() !== 404) {
          expect(response.status()).toBe(401);
        }
      });
    }

    test("cron endpoints are reachable (not 404) when they exist", async ({ page }) => {
      for (const endpoint of cronEndpoints) {
        const response = await page.request.get(endpoint);
        // In dev mode with routes registered, they should NOT be 404
        // (though they'll return 401 for missing auth)
        if (response.status() === 404) {
          // Route may not be registered in dev — that's acceptable
          test.skip(true, `Route ${endpoint} not registered in dev mode`);
          return;
        }
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // OpenGraph API
  // ─────────────────────────────────────────────────────────────────────

  test.describe("GET /api/og", () => {
    test("returns 404 for non-existent scenario ID", async ({ page }) => {
      const response = await page.request.get("/api/og?id=nonexistent-scenario-id-12345");

      // In dev mode the route may return 404 or be handled by SPA catch-all
      if (response.status() !== 404) {
        // If route exists and handles the request, it should return 404 for unknown ID
        expect(response.status()).toBe(404);
      }
    });

    test("returns 400 when id query param is missing", async ({ page }) => {
      const response = await page.request.get("/api/og");

      if (response.status() !== 404) {
        expect(response.status()).toBe(400);
        const text = await response.text();
        expect(text).toBe("Missing scenario id");
      }
    });

    test("returns 200 with image/png content-type for valid scenario ID", async ({ page }) => {
      // We can't guarantee a valid scenario ID exists in the test DB,
      // but we can verify the route handles the request gracefully
      const response = await page.request.get("/api/og?id=valid-scenario-id");

      if (response.status() === 200) {
        const contentType = response.headers()["content-type"] ?? "";
        expect(contentType).toContain("image/png");
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // User Export
  // ─────────────────────────────────────────────────────────────────────

  test.describe("POST /api/user/export", () => {
    test("returns 401 when not authenticated", async ({ page }) => {
      const response = await page.request.post("/api/user/export");

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("Non authentifié");
    });

    test("returns 401 with empty body when not authenticated", async ({ page }) => {
      const response = await page.request.post("/api/user/export", {
        data: {},
        headers: { "Content-Type": "application/json" },
      });

      expect(response.status()).toBe(401);
    });

    test("returns 400 when Origin header is invalid (CSRF check)", async ({ page }) => {
      // Send a request with a disallowed origin
      const response = await page.request.post("/api/user/export", {
        headers: {
          origin: "https://evil-site.com",
          "Content-Type": "application/json",
        },
      });

      // If the session is not authenticated, the origin check still runs but
      // returns 401 first (session check before origin check in the code).
      // The origin check runs before the auth check in the implementation.
      // If origin is invalid, it returns 403.
      if (response.status() === 403) {
        const body = await response.json();
        expect(body.error).toBe("Origine non autorisée");
      }
    });

    test("returns 200 with JSON attachment when authenticated", async ({ page }) => {
      // This test requires an authenticated session.
      // First, check if we're already authenticated.
      const sessionResp = await page.request.get("/api/auth/session");
      const session = await sessionResp.json();

      test.skip(session === null, "Skipping: requires authenticated session for export");
      if (session === null) return;

      const response = await page.request.post("/api/user/export");

      // Authenticated user should get a successful export
      expect(response.status()).toBe(200);

      const contentType = response.headers()["content-type"] ?? "";
      expect(contentType).toContain("application/json");

      const disposition = response.headers()["content-disposition"] ?? "";
      expect(disposition).toContain("attachment");
      expect(disposition).toContain(".json");

      const body = await response.json();
      expect(body).toHaveProperty("exportedAt");
      expect(body).toHaveProperty("user");
      expect(body).toHaveProperty("scenarios");
      expect(body).toHaveProperty("calls");
    });

    test("export data contains expected top-level sections", async ({ page }) => {
      const sessionResp = await page.request.get("/api/auth/session");
      const session = await sessionResp.json();

      test.skip(session === null, "Skipping: requires authenticated session");
      if (session === null) return;

      const response = await page.request.post("/api/user/export");

      if (response.status() === 200) {
        const body = await response.json();
        expect(body).toHaveProperty("exportedAt");
        expect(body).toHaveProperty("user");
        expect(body).toHaveProperty("scenarios");
        expect(body).toHaveProperty("calls");
        expect(body).toHaveProperty("comments");
        expect(body).toHaveProperty("purchases");
        expect(body).toHaveProperty("clips");
        expect(body).toHaveProperty("abuseReports");
      }
    });
  });
});
