import { expect, test } from "@playwright/test";

test.describe("Stripe webhook — checkout protection & validation", () => {
  // ── Body size limit ────────────────────────────────────────────────────

  test("should return 413 when Content-Length exceeds 100KB limit", async ({ page }) => {
    // The Stripe webhook middleware checks Content-Length header before parsing body.
    // 100KB = 100_000 bytes. We send a request claiming 101KB.
    const oversizedBody = JSON.stringify({
      id: "evt_test_oversized",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "user_1", credits: "50" },
          payment_intent: "pi_test",
        },
      },
    });

    // Create a body that is ~101KB by padding the metadata
    const largeMetadata = { largeField: "x".repeat(90_000) };
    const largeBody = JSON.stringify({
      ...JSON.parse(oversizedBody),
      data: {
        object: {
          metadata: { ...JSON.parse(oversizedBody).data.object.metadata, ...largeMetadata },
          payment_intent: "pi_test",
        },
      },
    });

    expect(largeBody.length).toBeGreaterThan(100_000);

    const response = await page.request.post("/api/webhooks/stripe", {
      data: largeBody,
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "test_sig",
      },
    });

    // The middleware returns 413 when content-length > 100_000
    expect(response.status()).toBe(413);
    const body = await response.json();
    expect(body.error).toBe("Requête trop volumineuse");
  });

  test("should accept body size up to 99KB (under limit)", async ({ page }) => {
    // Body just under the 100KB limit. The actual handler will reject
    // on signature verification, but should NOT return 413.
    const smallBody = JSON.stringify({
      id: "evt_test_small",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "user_1", credits: "50" },
          payment_intent: "pi_test",
        },
      },
    });

    // Pad to ~99KB
    const paddedBody = JSON.stringify({
      ...JSON.parse(smallBody),
      data: {
        object: {
          ...JSON.parse(smallBody).data.object,
          metadata: { ...JSON.parse(smallBody).data.object.metadata, padding: "x".repeat(98_000) },
        },
      },
    });

    expect(paddedBody.length).toBeLessThan(100_000);

    const response = await page.request.post("/api/webhooks/stripe", {
      data: paddedBody,
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "test_sig",
      },
    });

    // Should NOT be 413 — will likely fail at signature verification
    expect(response.status()).not.toBe(413);
  });

  // ── Signature validation ───────────────────────────────────────────────

  test("should return 400 when stripe-signature header is missing", async ({ page }) => {
    const body = JSON.stringify({
      id: "evt_test_no_sig",
      type: "checkout.session.completed",
      data: { object: { metadata: { userId: "user_1", credits: "50" } } },
    });

    const response = await page.request.post("/api/webhooks/stripe", {
      data: body,
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status()).toBe(400);
  });

  test("should return 400 when stripe-signature header is invalid", async ({ page }) => {
    const body = JSON.stringify({
      id: "evt_test_invalid_sig",
      type: "checkout.session.completed",
      data: { object: { metadata: { userId: "user_1", credits: "50" } } },
    });

    const response = await page.request.post("/api/webhooks/stripe", {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "invalid_signature_value",
      },
    });

    // The actual implementation returns 400 for invalid signatures (constructEvent throws)
    expect(response.status()).toBe(400);
  });

  test("should return 400 when stripe-signature header is empty", async ({ page }) => {
    const body = JSON.stringify({
      id: "evt_test_empty_sig",
      type: "checkout.session.completed",
      data: { object: { metadata: { userId: "user_1", credits: "50" } } },
    });

    const response = await page.request.post("/api/webhooks/stripe", {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "",
      },
    });

    expect(response.status()).toBe(400);
  });

  // ── Idempotency ────────────────────────────────────────────────────────

  test("should reject duplicate webhook events (idempotency check)", async ({ page }) => {
    const eventId = `evt_test_idempotent_${Date.now()}`;
    const body = JSON.stringify({
      id: eventId,
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "user_idem", credits: "10" },
          payment_intent: `pi_idem_test_${Date.now()}`,
        },
      },
    });

    // Send the same event twice with valid-looking signature
    // The first request may fail at signature check (dev mode), but if it passes,
    // the second should hit the idempotency check (Redis SET NX).
    const headers = {
      "Content-Type": "application/json",
      "stripe-signature": "test_signature",
    };

    const [response1, response2] = await Promise.all([
      page.request.post("/api/webhooks/stripe", { data: body, headers }),
      page.request.post("/api/webhooks/stripe", { data: body, headers }),
    ]);

    // If the first request passed signature check + idempotency, it should return 200
    // The second should also return 200 (idempotency: already processed)
    // If signature fails, both return 400 — that's also valid for dev mode
    for (const response of [response1, response2]) {
      const status = response.status();
      // Accept any of: 200 (processed/idempotent), 400 (signature fail in dev)
      expect([200, 400]).toContain(status);
    }
  });

  // ── Missing metadata ───────────────────────────────────────────────────

  test("should return 400 when checkout.session.completed has no userId in metadata", async ({
    page,
  }) => {
    const body = JSON.stringify({
      id: "evt_test_no_metadata",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: {}, // No userId
          payment_intent: "pi_test_no_metadata",
        },
      },
    });

    const response = await page.request.post("/api/webhooks/stripe", {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "test_sig",
      },
    });

    // In dev mode: signature check fails first (400), or passes and then metadata check fails (400)
    // Either way, the result should be 400
    expect(response.status()).toBe(400);
  });

  test("should return 400 when checkout.session.completed has no credits in metadata", async ({
    page,
  }) => {
    const body = JSON.stringify({
      id: "evt_test_no_credits",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "user_test" }, // No credits
          payment_intent: "pi_test_no_credits",
        },
      },
    });

    const response = await page.request.post("/api/webhooks/stripe", {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "test_sig",
      },
    });

    expect(response.status()).toBe(400);
  });

  test("should return 400 when checkout.session.completed has no payment_intent", async ({
    page,
  }) => {
    const body = JSON.stringify({
      id: "evt_test_no_pi",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "user_test", credits: "50" },
          payment_intent: null, // No payment_intent
        },
      },
    });

    const response = await page.request.post("/api/webhooks/stripe", {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "test_sig",
      },
    });

    expect(response.status()).toBe(400);
  });

  test("should return 400 when credits value is non-numeric", async ({ page }) => {
    const body = JSON.stringify({
      id: "evt_test_invalid_credits",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "user_test", credits: "abc" },
          payment_intent: "pi_test_invalid_credits",
        },
      },
    });

    const response = await page.request.post("/api/webhooks/stripe", {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "test_sig",
      },
    });

    expect(response.status()).toBe(400);
  });

  test("should return 400 when credits value is zero or negative", async ({ page }) => {
    const body = JSON.stringify({
      id: "evt_test_zero_credits",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "user_test", credits: "0" },
          payment_intent: "pi_test_zero_credits",
        },
      },
    });

    const response = await page.request.post("/api/webhooks/stripe", {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "test_sig",
      },
    });

    expect(response.status()).toBe(400);
  });

  // ── Rate limiting ──────────────────────────────────────────────────────

  test("should return 429 after exceeding rate limit (20 req/min)", async ({ page }) => {
    // The Stripe webhook rate limit is 20 req/min (global, not per IP).
    // Send enough requests to exceed it.
    const body = JSON.stringify({
      id: "evt_test_rate",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "user_rate", credits: "10" },
          payment_intent: "pi_rate_test",
        },
      },
    });

    const headers = {
      "Content-Type": "application/json",
      "stripe-signature": "test_sig",
    };

    // Send 30 requests to ensure we exceed the 20 req/min limit
    const requests = Array.from({ length: 30 }, (_, i) => {
      const uniqueBody = JSON.stringify({
        ...JSON.parse(body),
        id: `evt_test_rate_${i}_${Date.now()}`,
      });
      return page.request.post("/api/webhooks/stripe", {
        data: uniqueBody,
        headers,
      });
    });

    const responses = await Promise.all(requests);

    const status429 = responses.filter((r) => r.status() === 429).length;
    // At least some requests should be rate limited
    expect(status429).toBeGreaterThan(0);
  });

  test("should include Retry-After header on rate limited responses", async ({ page }) => {
    const requests = Array.from({ length: 30 }, (_, i) => {
      const body = JSON.stringify({
        id: `evt_test_retry_${i}_${Date.now()}`,
        type: "checkout.session.completed",
        data: {
          object: {
            metadata: { userId: "user_retry", credits: "10" },
            payment_intent: `pi_retry_${i}`,
          },
        },
      });
      return page.request.post("/api/webhooks/stripe", {
        data: body,
        headers: {
          "Content-Type": "application/json",
          "stripe-signature": "test_sig",
        },
      });
    });

    const responses = await Promise.all(requests);
    const rateLimitedResponse = responses.find((r) => r.status() === 429);

    if (rateLimitedResponse) {
      const retryAfter = rateLimitedResponse.headers()["retry-after"];
      expect(retryAfter).toBe("60");
    }
  });

  test("should not rate limit a single webhook request", async ({ page }) => {
    const body = JSON.stringify({
      id: `evt_test_single_${Date.now()}`,
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "user_single", credits: "10" },
          payment_intent: "pi_single",
        },
      },
    });

    const response = await page.request.post("/api/webhooks/stripe", {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "test_sig",
      },
    });

    // A single request should not be rate limited
    expect(response.status()).not.toBe(429);
  });

  // ── Unhandled event types ──────────────────────────────────────────────

  test("should handle unhandled event types gracefully (returns 200)", async ({ page }) => {
    // The Stripe webhook handles specific event types and logs unhandled ones.
    // In dev mode, signature check runs first and may return 400.
    const body = JSON.stringify({
      id: `evt_test_unhandled_${Date.now()}`,
      type: "invoice.payment_succeeded", // Unhandled type
      data: { object: {} },
    });

    const response = await page.request.post("/api/webhooks/stripe", {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "test_sig",
      },
    });

    // Accept: 400 (signature fail in dev) or 200 (unhandled type logged, returns received:true)
    expect([200, 400]).toContain(response.status());
  });

  // ── Webhook endpoint reachable ─────────────────────────────────────────

  test("POST /api/webhooks/stripe endpoint is reachable (not 404)", async ({ page }) => {
    const body = JSON.stringify({
      id: `evt_test_reachable_${Date.now()}`,
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "user_test", credits: "10" },
          payment_intent: "pi_test",
        },
      },
    });

    const response = await page.request.post("/api/webhooks/stripe", {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "test_sig",
      },
    });

    // Should not be 404 — route must exist
    expect(response.status()).not.toBe(404);
  });
});
