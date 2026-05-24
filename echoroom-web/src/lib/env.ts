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
});

type EnvType = z.infer<typeof envSchema>;

const DEV_DEFAULTS: EnvType = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://localhost:5432/echoroom?schema=public",
  NEXTAUTH_SECRET: "dev-secret-that-is-at-least-32-characters-long!!!",
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

function fillEnvWithDefaults(): EnvType {
  const merged: Record<string, string> = {};

  for (const key of Object.keys(DEV_DEFAULTS) as Array<keyof EnvType>) {
    const envValue = process.env[key];
    merged[key] = (envValue as string) ?? DEV_DEFAULTS[key];
  }

  const result = envSchema.safeParse(merged);
  if (!result.success) {
    console.error(
      "Env validation failed with defaults:",
      JSON.stringify(result.error.flatten().fieldErrors),
    );
    throw new Error("Invalid environment variables");
  }

  return result.data;
}

let cached: EnvType | null = null;

function getEnv(): EnvType {
  if (cached) return cached;
  cached = fillEnvWithDefaults();
  return cached;
}

export const env = new Proxy({} as EnvType, {
  get(_target, prop: string | symbol) {
    return getEnv()[prop as keyof EnvType];
  },
});

/**
 * Call this at application startup in production to validate that
 * real environment variables are set (not dev defaults).
 */
export function validateProductionEnv(): void {
  if (process.env.NODE_ENV !== "production") return;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error(
      "Invalid production environment variables:",
      JSON.stringify(result.error.flatten().fieldErrors),
    );
    throw new Error("Invalid production environment variables");
  }
}
