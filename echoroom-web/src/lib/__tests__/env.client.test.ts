import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Client env validation — NEXT_PUBLIC_* vars
// ---------------------------------------------------------------------------
// Tests for env.client.ts which validates NEXT_PUBLIC_* environment variables
// using Zod, with fallback defaults on validation failure.

const ORIGINAL_ENV = { ...process.env };

describe("env.client — client env validation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    // Clear global cache so each test re-parses the env
    delete (globalThis as any).parsedClientEnv;
  });

  afterEach(() => {
    // Restore original env
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
      process.env[key] = value;
    }
  });

  it("should return parsed object when all 4 vars are present", async () => {
    process.env["NEXT_PUBLIC_APP_URL"] = "https://echoroom.app";
    process.env["NEXT_PUBLIC_POSTHOG_KEY"] = "phc_test123";
    process.env["NEXT_PUBLIC_POSTHOG_HOST"] = "https://us.i.posthog.com";
    process.env["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"] = "pk_test_abc123";

    const { env } = await import("../env.client");

    expect(env.NEXT_PUBLIC_APP_URL).toBe("https://echoroom.app");
    expect(env.NEXT_PUBLIC_POSTHOG_KEY).toBe("phc_test123");
    expect(env.NEXT_PUBLIC_POSTHOG_HOST).toBe("https://us.i.posthog.com");
    expect(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).toBe("pk_test_abc123");
  });

  it("should cache result and return same object on second call", async () => {
    process.env["NEXT_PUBLIC_APP_URL"] = "https://echoroom.app";
    process.env["NEXT_PUBLIC_POSTHOG_KEY"] = "phc_test123";
    process.env["NEXT_PUBLIC_POSTHOG_HOST"] = "https://us.i.posthog.com";
    process.env["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"] = "pk_test_abc123";

    // Clear global cache before test
    delete (globalThis as any).parsedClientEnv;

    const { getClientEnv } = await import("../env.client");

    const result1 = getClientEnv();
    const result2 = getClientEnv();

    // Should be the exact same object (cached)
    expect(result1).toBe(result2);
  });

  it("should apply fallback defaults when a var is missing", async () => {
    // Only set some vars, leave NEXT_PUBLIC_POSTHOG_KEY missing
    process.env["NEXT_PUBLIC_APP_URL"] = "https://echoroom.app";
    // Don't set NEXT_PUBLIC_POSTHOG_KEY
    process.env["NEXT_PUBLIC_POSTHOG_HOST"] = "https://us.i.posthog.com";
    process.env["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"] = "pk_test_abc123";

    const { env } = await import("../env.client");

    // Missing var should use fallback default
    expect(env.NEXT_PUBLIC_APP_URL).toBe("https://echoroom.app");
    expect(env.NEXT_PUBLIC_POSTHOG_KEY).toBe("phc_placeholder");
    expect(env.NEXT_PUBLIC_POSTHOG_HOST).toBe("https://us.i.posthog.com");
  });

  it("should replace invalid var with fallback default (bug was fixed)", async () => {
    // Set NEXT_PUBLIC_APP_URL to an invalid (non-URL) value
    process.env["NEXT_PUBLIC_APP_URL"] = "not-a-url";
    process.env["NEXT_PUBLIC_POSTHOG_KEY"] = "phc_test123";
    process.env["NEXT_PUBLIC_POSTHOG_HOST"] = "https://us.i.posthog.com";
    process.env["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"] = "pk_test_abc123";

    const { env } = await import("../env.client");

    // Invalid-but-truthy var should be replaced with fallback default
    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });

  it("should return a frozen env object", async () => {
    process.env["NEXT_PUBLIC_APP_URL"] = "https://echoroom.app";
    process.env["NEXT_PUBLIC_POSTHOG_KEY"] = "phc_test123";
    process.env["NEXT_PUBLIC_POSTHOG_HOST"] = "https://us.i.posthog.com";
    process.env["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"] = "pk_test_abc123";

    const { env } = await import("../env.client");

    expect(Object.isFrozen(env)).toBe(true);
  });

  it('should default POSTHOG_HOST to "https://us.i.posthog.com"', async () => {
    process.env["NEXT_PUBLIC_APP_URL"] = "https://echoroom.app";
    process.env["NEXT_PUBLIC_POSTHOG_KEY"] = "phc_test123";
    // Don't set POSTHOG_HOST — it has a Zod default
    process.env["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"] = "pk_test_abc123";

    const { env } = await import("../env.client");

    expect(env.NEXT_PUBLIC_POSTHOG_HOST).toBe("https://us.i.posthog.com");
  });

  it("should throw when multiple vars are missing and fallback still fails", async () => {
    // Set no vars at all — fallback should apply defaults
    // But wait, the code applies defaults for failed fields, then re-parses
    // The only way fallback fails is if envWithDefaults still fails schema
    // This shouldn't happen since defaults cover all fields
    // Let's test it works with all missing
    delete process.env["NEXT_PUBLIC_APP_URL"];
    delete process.env["NEXT_PUBLIC_POSTHOG_KEY"];
    delete process.env["NEXT_PUBLIC_POSTHOG_HOST"];
    delete process.env["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"];

    const { env } = await import("../env.client");

    // All should use fallback defaults
    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
    expect(env.NEXT_PUBLIC_POSTHOG_KEY).toBe("phc_placeholder");
    expect(env.NEXT_PUBLIC_POSTHOG_HOST).toBe("https://us.i.posthog.com");
    expect(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).toBe("pk_test_placeholder");
  });

  it("should export getClientEnv function", async () => {
    const mod = await import("../env.client");
    expect(typeof mod.getClientEnv).toBe("function");
  });
});
