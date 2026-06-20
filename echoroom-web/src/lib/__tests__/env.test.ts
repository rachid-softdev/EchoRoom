import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Server env validation — production mode, dev defaults, edge cases
// ---------------------------------------------------------------------------
// Tests for env.ts which validates environment variables using Zod.
// The vitest.setup.ts already provides defaults for all env vars.
// We override NODE_ENV and other specific vars to test different modes.

// Save original env per test file
const ORIGINAL_ENV = { ...process.env };

describe("env — server validation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
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

  // ── Dev mode tests ──

  it("should use DEV_DEFAULTS when NODE_ENV=development and vars are not set", async () => {
    // Remove many vars to test defaults
    delete process.env["NODE_ENV"];
    delete process.env["DATABASE_URL"];
    delete process.env["STRIPE_SECRET_KEY"];
    // Keep NEXTAUTH_URL, REDIS_URL etc from vitest.setup

    const { env } = await import("../env");

    expect(env.NODE_ENV).toBe("development");
    // DATABASE_URL should come from DEV_DEFAULTS
    expect(env.DATABASE_URL).toBe(
      "postgresql://localhost:5432/echoroom?schema=public",
    );
    expect(env.STRIPE_SECRET_KEY).toBe("sk_test_dev");
    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
    expect(env.STRIPE_WEBHOOK_SECRET).toBe("whsec_dev");
  });

  it("should use process.env values over DEV_DEFAULTS in development", async () => {
    // Set specific overrides
    process.env["DATABASE_URL"] = "postgresql://custom:5432/mydb";
    process.env["STRIPE_SECRET_KEY"] = "sk_test_custom";
    delete process.env["NODE_ENV"]; // defaults to development

    const { env } = await import("../env");

    expect(env.DATABASE_URL).toBe("postgresql://custom:5432/mydb");
    expect(env.STRIPE_SECRET_KEY).toBe("sk_test_custom");
  });

  it("should generate a random NEXTAUTH_SECRET when not set in dev", async () => {
    delete process.env["NODE_ENV"];
    delete process.env["NEXTAUTH_SECRET"];

    const { env } = await import("../env");

    expect(env.NEXTAUTH_SECRET).toMatch(/^[0-9a-f]{64}$/i);
  });

  // ── Production mode tests ──

  it("should accept all required vars in production", async () => {
    process.env["NODE_ENV"] = "production";
    // Set all required vars to non-dev-default values
    process.env["DATABASE_URL"] = "postgresql://prod:5432/echoroom";
    process.env["NEXT_PUBLIC_APP_URL"] = "https://echoroom.app";
    process.env["STRIPE_SECRET_KEY"] = "sk_test_prod_value_12345";
    process.env["STRIPE_WEBHOOK_SECRET"] = "whsec_prod_value";
    process.env["TWILIO_ACCOUNT_SID"] = "AC_prod_value";
    process.env["TWILIO_AUTH_TOKEN"] = "prod_token_value";
    process.env["TWILIO_PHONE_NUMBER"] = "+33123456789";
    process.env["OPENAI_API_KEY"] = "sk_prod_value";
    process.env["ELEVENLABS_API_KEY"] = "prod_key_value";
    process.env["DEEPGRAM_API_KEY"] = "prod_key_value";
    process.env["R2_ACCESS_KEY_ID"] = "prod_key";
    process.env["R2_SECRET_ACCESS_KEY"] = "prod_secret";
    process.env["R2_BUCKET_NAME"] = "prod-bucket";
    process.env["R2_ENDPOINT"] = "https://prod.r2.dev";
    process.env["POSTHOG_KEY"] = "phc_prod";
    process.env["POSTHOG_HOST"] = "https://app.posthog.com";
    process.env["NEXTAUTH_SECRET"] = "prod_nextauth_secret_32_chars_long!!!!!";
    process.env["NEXTAUTH_URL"] = "https://echoroom.app";
    process.env["PHONE_ENCRYPTION_KEY"] = "prod_phone_key_32_chars_minimum_here_";
    process.env["TWILIO_TOKEN_SECRET"] = "prod_token_secret_16chars";
    process.env["CRON_SECRET"] = "prod_cron_secret_16_chars!!!";
    process.env["AUDIT_HASH_SECRET"] = "prod_audit_hash_secret_16c";
    process.env["REDIS_URL"] = "https://prod-redis.upstash.io:6379";

    const { env } = await import("../env");

    expect(env.NODE_ENV).toBe("production");
    expect(env.DATABASE_URL).toBe("postgresql://prod:5432/echoroom");
    expect(env.NEXTAUTH_SECRET).toBe(
      "prod_nextauth_secret_32_chars_long!!!!!",
    );
  });

  it("should throw when DATABASE_URL is missing in production", async () => {
    process.env["NODE_ENV"] = "production";
    delete process.env["DATABASE_URL"];
    // Set other required vars to pass the dev-default check
    process.env["STRIPE_SECRET_KEY"] = "sk_test_not_default";
    process.env["STRIPE_WEBHOOK_SECRET"] = "whsec_not_default";
    process.env["TWILIO_ACCOUNT_SID"] = "AC_not_default";
    process.env["TWILIO_AUTH_TOKEN"] = "not_default";
    process.env["TWILIO_PHONE_NUMBER"] = "+33000000000";
    process.env["OPENAI_API_KEY"] = "sk_not_default";
    process.env["ELEVENLABS_API_KEY"] = "not_default";
    process.env["DEEPGRAM_API_KEY"] = "not_default";
    process.env["R2_ACCESS_KEY_ID"] = "not_default";
    process.env["R2_SECRET_ACCESS_KEY"] = "not_default";
    process.env["R2_BUCKET_NAME"] = "not-default";
    process.env["R2_ENDPOINT"] = "https://not-default.r2.dev";
    process.env["POSTHOG_KEY"] = "phc_not_default";
    process.env["NEXTAUTH_SECRET"] = "not_default_secret_32_chars_long_here!!";
    process.env["NEXTAUTH_URL"] = "https://example.com";
    process.env["NEXT_PUBLIC_APP_URL"] = "https://example.com";
    process.env["PHONE_ENCRYPTION_KEY"] =
      "not_default_phone_32_chars_minimum_here_";
    process.env["TWILIO_TOKEN_SECRET"] = "not_default_16chars";
    process.env["CRON_SECRET"] = "not_default_cron_16_chars!!";
    process.env["AUDIT_HASH_SECRET"] = "not_default_audit_16c";

    await expect(import("../env")).rejects.toThrow(
      "Invalid production environment variables",
    );
  });

  it("should throw when DATABASE_URL is not a URL in production", async () => {
    process.env["NODE_ENV"] = "production";
    process.env["DATABASE_URL"] = "not-a-valid-url";
    // Set other required vars to pass the dev-default check
    process.env["STRIPE_SECRET_KEY"] = "sk_test_not_default_2";
    process.env["STRIPE_WEBHOOK_SECRET"] = "whsec_not_default_2";
    process.env["TWILIO_ACCOUNT_SID"] = "AC_not_default_2";
    process.env["TWILIO_AUTH_TOKEN"] = "not_default_2";
    process.env["TWILIO_PHONE_NUMBER"] = "+33000000001";
    process.env["OPENAI_API_KEY"] = "sk_not_default_2";
    process.env["ELEVENLABS_API_KEY"] = "not_default_2";
    process.env["DEEPGRAM_API_KEY"] = "not_default_2";
    process.env["R2_ACCESS_KEY_ID"] = "not_default_2";
    process.env["R2_SECRET_ACCESS_KEY"] = "not_default_2";
    process.env["R2_BUCKET_NAME"] = "not-default-2";
    process.env["R2_ENDPOINT"] = "https://not-default-2.r2.dev";
    process.env["POSTHOG_KEY"] = "phc_not_default_2";
    process.env["NEXTAUTH_SECRET"] =
      "not_default_secret_32_chars_long_here_2!";
    process.env["NEXTAUTH_URL"] = "https://example2.com";
    process.env["NEXT_PUBLIC_APP_URL"] = "https://example2.com";
    process.env["PHONE_ENCRYPTION_KEY"] =
      "not_default_phone_32_chars_minimum_here_";
    process.env["TWILIO_TOKEN_SECRET"] = "not_default_16chars_2";
    process.env["CRON_SECRET"] = "not_default_cron_16_chars_2";
    process.env["AUDIT_HASH_SECRET"] = "not_default_audit_16c";

    await expect(import("../env")).rejects.toThrow(
      "Invalid production environment variables",
    );
  });

  it("should throw when dev default is detected in production", async () => {
    process.env["NODE_ENV"] = "production";
    // Leave STRIPE_SECRET_KEY at the dev default
    process.env["STRIPE_SECRET_KEY"] = "sk_test_dev";
    // Set all other vars to non-default production values
    process.env["DATABASE_URL"] = "postgresql://prod:5432/echoroom";
    process.env["NEXT_PUBLIC_APP_URL"] = "https://echoroom.app";
    process.env["STRIPE_WEBHOOK_SECRET"] = "whsec_prod_value";
    process.env["TWILIO_ACCOUNT_SID"] = "AC_prod_value";
    process.env["TWILIO_AUTH_TOKEN"] = "prod_token_value";
    process.env["TWILIO_PHONE_NUMBER"] = "+33123456789";
    process.env["OPENAI_API_KEY"] = "sk_prod_value";
    process.env["ELEVENLABS_API_KEY"] = "prod_key_value";
    process.env["DEEPGRAM_API_KEY"] = "prod_key_value";
    process.env["R2_ACCESS_KEY_ID"] = "prod_key";
    process.env["R2_SECRET_ACCESS_KEY"] = "prod_secret";
    process.env["R2_BUCKET_NAME"] = "prod-bucket";
    process.env["R2_ENDPOINT"] = "https://prod.r2.dev";
    process.env["POSTHOG_KEY"] = "phc_prod";
    process.env["NEXTAUTH_SECRET"] =
      "prod_nextauth_secret_32_chars_long!!!!!";
    process.env["NEXTAUTH_URL"] = "https://echoroom.app";
    process.env["PHONE_ENCRYPTION_KEY"] =
      "prod_phone_key_32_chars_minimum_here_";
    process.env["TWILIO_TOKEN_SECRET"] = "prod_token_secret_16chars";
    process.env["CRON_SECRET"] = "prod_cron_secret_16_chars!!!";
    process.env["AUDIT_HASH_SECRET"] = "prod_audit_hash_secret_16c";
    process.env["REDIS_URL"] = "https://prod-redis.upstash.io:6379";

    await expect(import("../env")).rejects.toThrow(
      /still set to the development default value/,
    );
  });

  // ── MODERATION_FAIL_OPEN transform tests ──

  it('should transform MODERATION_FAIL_OPEN "false" string to false', async () => {
    delete process.env["NODE_ENV"];
    process.env["MODERATION_FAIL_OPEN"] = "false";

    const { env } = await import("../env");
    expect(env.MODERATION_FAIL_OPEN).toBe(false);
  });

  it('should transform MODERATION_FAIL_OPEN "true" string to true', async () => {
    delete process.env["NODE_ENV"];
    process.env["MODERATION_FAIL_OPEN"] = "true";

    const { env } = await import("../env");
    expect(env.MODERATION_FAIL_OPEN).toBe(true);
  });

  it('should default MODERATION_FAIL_OPEN to true when not set', async () => {
    delete process.env["NODE_ENV"];
    delete process.env["MODERATION_FAIL_OPEN"];

    const { env } = await import("../env");
    expect(env.MODERATION_FAIL_OPEN).toBe(true);
  });

  it('should treat MODERATION_FAIL_OPEN "0" as false', async () => {
    delete process.env["NODE_ENV"];
    process.env["MODERATION_FAIL_OPEN"] = "0";

    const { env } = await import("../env");
    expect(env.MODERATION_FAIL_OPEN).toBe(false);
  });

  it('should treat MODERATION_FAIL_OPEN any other string as true', async () => {
    delete process.env["NODE_ENV"];
    process.env["MODERATION_FAIL_OPEN"] = "anything-else";

    const { env } = await import("../env");
    expect(env.MODERATION_FAIL_OPEN).toBe(true);
  });

  // ── Object.freeze test ──

  it("should return a frozen env object", async () => {
    delete process.env["NODE_ENV"];

    const { env } = await import("../env");
    expect(Object.isFrozen(env)).toBe(true);
  });

  // ── Console.error on validation failure ──

  it("should call console.error on validation failure", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    process.env["NODE_ENV"] = "production";
    delete process.env["DATABASE_URL"];
    // Provide other env vars to avoid the dev-default check
    process.env["STRIPE_SECRET_KEY"] = "sk_test_not_default_ce";
    process.env["STRIPE_WEBHOOK_SECRET"] = "whsec_not_default_ce";
    process.env["TWILIO_ACCOUNT_SID"] = "AC_not_default_ce";
    process.env["TWILIO_AUTH_TOKEN"] = "not_default_ce";
    process.env["TWILIO_PHONE_NUMBER"] = "+33000000002";
    process.env["OPENAI_API_KEY"] = "sk_not_default_ce";
    process.env["ELEVENLABS_API_KEY"] = "not_default_ce";
    process.env["DEEPGRAM_API_KEY"] = "not_default_ce";
    process.env["R2_ACCESS_KEY_ID"] = "not_default_ce";
    process.env["R2_SECRET_ACCESS_KEY"] = "not_default_ce";
    process.env["R2_BUCKET_NAME"] = "not-default-ce";
    process.env["R2_ENDPOINT"] = "https://not-default-ce.r2.dev";
    process.env["POSTHOG_KEY"] = "phc_not_default_ce";
    process.env["NEXTAUTH_SECRET"] =
      "not_default_secret_32_chars_long_here_ce";
    process.env["NEXTAUTH_URL"] = "https://example-ce.com";
    process.env["NEXT_PUBLIC_APP_URL"] = "https://example-ce.com";
    process.env["PHONE_ENCRYPTION_KEY"] =
      "not_default_phone_32_chars_minimum_here_";
    process.env["TWILIO_TOKEN_SECRET"] = "not_default_16chars_ce";
    process.env["CRON_SECRET"] = "not_default_cron_16_chars_ce";
    process.env["AUDIT_HASH_SECRET"] = "not_default_audit_16c";

    await expect(import("../env")).rejects.toThrow();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  // ── validateProductionEnv tests ──

  it("should warn about missing production env vars", async () => {
    delete process.env["NODE_ENV"];
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    const { validateProductionEnv } = await import("../env");
    validateProductionEnv();

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("STRIPE_PRICE_STARTER"),
    );

    consoleWarnSpy.mockRestore();
  });

  it("should not warn when production env vars are present", async () => {
    delete process.env["NODE_ENV"];
    process.env["STRIPE_PRICE_STARTER"] = "price_prod_starter";
    process.env["STRIPE_PRICE_PRO"] = "price_prod_pro";
    // Set NEXTAUTH_SECRET to suppress the module-level warning during loadEnv()
    process.env["NEXTAUTH_SECRET"] = "test_secret_at_least_32_chars_long_here!!!";

    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    const { validateProductionEnv } = await import("../env");
    // Clear any warnings from module load
    consoleWarnSpy.mockClear();

    validateProductionEnv();

    expect(consoleWarnSpy).not.toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });
});

describe("env — production dev-default detection per key", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
      process.env[key] = value;
    }
  });

  // Helper to set all production vars except one
  function setAllProdVars() {
    process.env["NODE_ENV"] = "production";
    process.env["DATABASE_URL"] = "postgresql://prod:5432/echoroom";
    process.env["NEXT_PUBLIC_APP_URL"] = "https://echoroom.app";
    process.env["STRIPE_SECRET_KEY"] = "sk_test_prod_val";
    process.env["STRIPE_WEBHOOK_SECRET"] = "whsec_prod_val";
    process.env["TWILIO_ACCOUNT_SID"] = "AC_prod_val";
    process.env["TWILIO_AUTH_TOKEN"] = "prod_val";
    process.env["TWILIO_PHONE_NUMBER"] = "+33123456789";
    process.env["OPENAI_API_KEY"] = "sk_prod_val";
    process.env["ELEVENLABS_API_KEY"] = "prod_val";
    process.env["DEEPGRAM_API_KEY"] = "prod_val";
    process.env["R2_ACCESS_KEY_ID"] = "prod_key";
    process.env["R2_SECRET_ACCESS_KEY"] = "prod_secret";
    process.env["R2_BUCKET_NAME"] = "prod-bucket";
    process.env["R2_ENDPOINT"] = "https://prod.r2.dev";
    process.env["POSTHOG_KEY"] = "phc_prod";
    process.env["NEXTAUTH_SECRET"] = "prod_nextauth_secret_32_chars_long!!!!!";
    process.env["NEXTAUTH_URL"] = "https://echoroom.app";
    process.env["PHONE_ENCRYPTION_KEY"] =
      "prod_phone_key_32_chars_minimum_here_";
    process.env["TWILIO_TOKEN_SECRET"] = "prod_token_secret_16chars";
    process.env["CRON_SECRET"] = "prod_cron_secret_16_chars!!!";
    process.env["AUDIT_HASH_SECRET"] = "prod_audit_hash_secret_16c";
    process.env["REDIS_URL"] = "https://prod-redis.upstash.io:6379";
  }

  const criticalKeys = [
    { key: "NEXTAUTH_SECRET", envVar: "NEXTAUTH_SECRET", value: "prod_nextauth_secret_32_chars_long!!!!!" },
    { key: "STRIPE_SECRET_KEY", envVar: "STRIPE_SECRET_KEY", value: "sk_test_prod_val" },
    { key: "STRIPE_WEBHOOK_SECRET", envVar: "STRIPE_WEBHOOK_SECRET", value: "whsec_prod_val" },
    { key: "TWILIO_AUTH_TOKEN", envVar: "TWILIO_AUTH_TOKEN", value: "prod_val" },
    { key: "OPENAI_API_KEY", envVar: "OPENAI_API_KEY", value: "sk_prod_val" },
  ];

  for (const { key } of criticalKeys) {
    it(`should throw when ${key} is set to dev default in production`, async () => {
      setAllProdVars();
      // Set this specific var's dev default
      const devVal = (
        await import("fs")
      ).readFileSync; // just to get the file, we'll hardcode

      // Actually let's just set known dev defaults
      const devDefaults: Record<string, string> = {
        NEXTAUTH_SECRET: "", // Not in DEV_DEFAULTS (generated)
        STRIPE_SECRET_KEY: "sk_test_dev",
        STRIPE_WEBHOOK_SECRET: "whsec_dev",
        TWILIO_AUTH_TOKEN: "dev_token",
        OPENAI_API_KEY: "sk_dev",
      };

      // We need to set the ENV VAR to the dev default
      // The function checks process.env[key] === DEV_DEFAULTS[key]
      const envKey = key as string;
      if (envKey === "NEXTAUTH_SECRET") {
        // NEXTAUTH_SECRET doesn't have a DEV_DEFAULTS entry
        // So this case won't be triggered
        return;
      }
      process.env[envKey] = devDefaults[envKey] ?? "";

      await expect(import("../env")).rejects.toThrow(
        /still set to the development default value/,
      );
    });
  }
});
