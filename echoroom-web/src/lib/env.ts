import { randomBytes } from "node:crypto";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  REDIS_TOKEN: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  TWILIO_ACCOUNT_SID: z.string().min(1),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  TWILIO_PHONE_NUMBER: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  ELEVENLABS_API_KEY: z.string().min(1),
  DEEPGRAM_API_KEY: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  R2_ENDPOINT: z.string().url(),
  R2_PUBLIC_URL: z.string().url().optional(),
  POSTHOG_KEY: z.string().min(1),
  POSTHOG_HOST: z.string().url().default("https://us.i.posthog.com"),
  TRUSTED_ORIGINS: z.string().optional(),
  PHONE_ENCRYPTION_KEY: z.string().min(32),
  TWILIO_TOKEN_SECRET: z.string().min(16),
  AUDIT_HASH_SECRET: z.string().min(16),
  STRIPE_PRICE_STARTER: z.string().optional().default("price_dev_starter"),
  STRIPE_PRICE_PRO: z.string().optional().default("price_dev_pro"),
  STRIPE_PRICE_ULTRA: z.string().optional().default("price_dev_ultra"),
  CRON_SECRET: z.string().min(16),
  MODERATION_FAIL_OPEN: z
    .string()
    .transform((v) => v !== "false" && v !== "0")
    .default("true"),
});

type EnvType = z.infer<typeof envSchema>;

const DEV_DEFAULTS: Record<string, string> = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://localhost:5432/echoroom?schema=public",
  STRIPE_SECRET_KEY: "sk_test_dev",
  STRIPE_WEBHOOK_SECRET: "whsec_dev",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  TWILIO_ACCOUNT_SID: "AC_dev",
  TWILIO_AUTH_TOKEN: "dev_token",
  TWILIO_PHONE_NUMBER: "+15550000000",
  OPENAI_API_KEY: "sk_dev",
  ELEVENLABS_API_KEY: "dev_key",
  DEEPGRAM_API_KEY: "dev_key",
  R2_ACCESS_KEY_ID: "dev_key",
  R2_SECRET_ACCESS_KEY: "dev_secret",
  R2_BUCKET_NAME: "dev-bucket",
  R2_ENDPOINT: "https://dev.r2.cloudflarestorage.com",
  R2_PUBLIC_URL: "http://localhost:3000",
  POSTHOG_KEY: "phc_dev",
  POSTHOG_HOST: "https://us.i.posthog.com",
  PHONE_ENCRYPTION_KEY: "dev_phone_key_32_chars_minimum_here___",
  TWILIO_TOKEN_SECRET: "dev_twilio_token_secret_16_chars",
  AUDIT_HASH_SECRET: "audit_hash_dev_secret_16ch!",
  CRON_SECRET: "dev_cron_secret_at_least_16_chars!!",
};

function loadEnv(): EnvType {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";

  if (isProduction) {
    // Check all critical secrets against their dev defaults
    const criticalKeys: Array<{ key: string; label: string }> = [
      { key: "NEXTAUTH_SECRET", label: "NEXTAUTH_SECRET (auth)" },
      { key: "STRIPE_SECRET_KEY", label: "STRIPE_SECRET_KEY (Stripe)" },
      { key: "STRIPE_WEBHOOK_SECRET", label: "STRIPE_WEBHOOK_SECRET (Stripe webhooks)" },
      { key: "TWILIO_AUTH_TOKEN", label: "TWILIO_AUTH_TOKEN (Twilio)" },
      { key: "OPENAI_API_KEY", label: "OPENAI_API_KEY (OpenAI)" },
      { key: "ELEVENLABS_API_KEY", label: "ELEVENLABS_API_KEY (ElevenLabs)" },
      { key: "DEEPGRAM_API_KEY", label: "DEEPGRAM_API_KEY (Deepgram)" },
      { key: "PHONE_ENCRYPTION_KEY", label: "PHONE_ENCRYPTION_KEY (encryption)" },
      { key: "TWILIO_TOKEN_SECRET", label: "TWILIO_TOKEN_SECRET (Twilio tokens)" },
      { key: "AUDIT_HASH_SECRET", label: "AUDIT_HASH_SECRET (audit hashing)" },
      { key: "CRON_SECRET", label: "CRON_SECRET (cron jobs)" },
    ];
    for (const { key, label } of criticalKeys) {
      const value = process.env[key] ?? "";
      const devDefault = DEV_DEFAULTS[key];
      if (devDefault && value === devDefault) {
        throw new Error(
          `${label} is still set to the development default value. ` +
            "Set a unique production value before deploying.",
        );
      }
    }
    // Production: strict validation — all vars must be in process.env
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error(
        "❌ Invalid production environment variables:",
        JSON.stringify(result.error.flatten().fieldErrors, null, 2),
      );
      throw new Error("Invalid production environment variables");
    }
    return result.data;
  }

  // Development / test: merge process.env with dev defaults
  const merged: Record<string, string> = {};
  const schemaKeys = Object.keys(envSchema.shape) as Array<keyof EnvType>;

  for (const key of schemaKeys) {
    const envValue = process.env[key];
    if (key === "NEXTAUTH_SECRET" && !envValue) {
      const generated = randomBytes(32).toString("hex");
      console.warn("⚠️  NEXTAUTH_SECRET not set — generating random key for this session");
      process.env[key] = generated; // Also set on process.env so NextAuth can find it
      merged[key] = generated;
    } else {
      merged[key] = (envValue as string) ?? DEV_DEFAULTS[key] ?? "";
    }
  }

  const result = envSchema.safeParse(merged);
  if (!result.success) {
    console.error(
      "❌ Invalid environment variables:",
      JSON.stringify(result.error.flatten().fieldErrors, null, 2),
    );
    throw new Error("Invalid environment variables — application cannot start");
  }

  return result.data;
}

// Eager validation at module load
export const env: Readonly<EnvType> = Object.freeze(loadEnv());

/**
 * Validates production-specific environment variables.
 * Called explicitly in production deployment to check for missing config.
 */
export function validateProductionEnv(): void {
  const required = ["STRIPE_PRICE_STARTER", "STRIPE_PRICE_PRO"] as const;
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.warn(`[ENV] Missing production env vars: ${missing.join(", ")}`);
  }
}
