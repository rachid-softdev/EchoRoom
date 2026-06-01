import { test, expect } from "@playwright/test";

test.describe("Twilio webhook protection — security tests", () => {
  test("should return 403 when x-twilio-signature header is missing", async ({ page }) => {
    // Use playwright's APIRequestContext for direct HTTP requests
    const response = await page.request.post("/api/webhooks/twilio", {
      form: {
        CallSid: "CA_test_missing_sig",
        CallStatus: "completed",
      },
      headers: {
        // Intentionally NOT sending x-twilio-signature
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Signature manquante");
  });

  test("should return 403 when x-twilio-signature header is invalid", async ({ page }) => {
    const response = await page.request.post("/api/webhooks/twilio", {
      form: {
        CallSid: "CA_test_invalid_sig",
        CallStatus: "completed",
      },
      headers: {
        "x-twilio-signature": "invalid_signature_value_here",
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Signature invalide");
  });

  test("should return 403 when signature is empty string", async ({ page }) => {
    const response = await page.request.post("/api/webhooks/twilio", {
      form: {
        CallSid: "CA_test_empty_sig",
        CallStatus: "completed",
      },
      headers: {
        "x-twilio-signature": "",
      },
    });

    expect(response.status()).toBe(403);
  });

  test("should return 413 when body content exceeds 50KB limit", async ({ page }) => {
    // Generate a large payload that exceeds 50KB
    const largeValue = "x".repeat(60_000); // ~60KB

    const response = await page.request.post("/api/webhooks/twilio", {
      form: {
        CallSid: largeValue,
        CallStatus: "completed",
      },
      headers: {
        "x-twilio-signature": "some_signature",
      },
    });

    expect(response.status()).toBe(413);
    const body = await response.json();
    expect(body.error).toBe("Requête trop volumineuse");
  });

  test("should return 403 on voice webhook without signature", async ({ page }) => {
    const response = await page.request.post("/api/webhooks/twilio/voice", {
      form: {
        CallSid: "CA_test_voice",
        Digits: "1",
      },
      headers: {
        // No signature
      },
    });

    expect(response.status()).toBe(403);
  });

  test("should return 403 on voice input webhook without signature", async ({ page }) => {
    const response = await page.request.post("/api/webhooks/twilio/voice/handle-input", {
      form: {
        CallSid: "CA_test_input",
        SpeechResult: "hello",
      },
      headers: {
        // No signature
      },
    });

    expect(response.status()).toBe(403);
  });

  test("should return 403 on stream webhook without signature", async ({ page }) => {
    const response = await page.request.post("/api/webhooks/twilio/voice/stream", {
      form: {
        CallSid: "CA_test_stream",
      },
      headers: {
        // No signature
      },
    });

    expect(response.status()).toBe(403);
  });

  test("should accept valid Content-Type for webhook (application/x-www-form-urlencoded)", async ({ page }) => {
    // Playwright's request.post with form: sends as application/x-www-form-urlencoded
    const response = await page.request.post("/api/webhooks/twilio", {
      form: {
        CallSid: "CA_test_content_type",
      },
      headers: {
        "x-twilio-signature": "test",
      },
    });

    // Should fail on invalid signature, not on content type
    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Signature invalide");
  });
});
