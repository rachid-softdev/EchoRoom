import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
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
});

type EnvType = z.infer<typeof envSchema>;

const DEV_DEFAULTS: Record<string, string> = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://localhost:5432/echoroom?schema=public",
  NEXTAUTH_SECRET: "CHANGE_ME_BEFORE_PRODUCTION_aaaaaaaaaaaaaaaaaaaa",
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
  POSTHOG_KEY: "phc_dev",
  POSTHOG_HOST: "https://us.i.posthog.com",
};

function loadEnv(): EnvType {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";

  if (isProduction) {
    const secret = process.env.NEXTAUTH_SECRET ?? "";
    if (secret.startsWith("CHANGE_ME")) {
      throw new Error(
        "NEXTAUTH_SECRET is still set to the default value. " +
        "Generate a unique secret before deploying to production.",
      );
    }
  }

  if (isProduction) {
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
    merged[key] = (envValue as string) ?? DEV_DEFAULTS[key] ?? "";
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
 * No-op kept for backward compatibility.
 * Validation now happens at module import time.
 */
export function validateProductionEnv(): void {
  // Validation already performed in loadEnv() during module initialization
}
