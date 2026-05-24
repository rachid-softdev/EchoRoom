import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().default("https://us.i.posthog.com"),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
});

const globalForClientEnv = globalThis as unknown as {
  parsedClientEnv: z.infer<typeof clientEnvSchema> | undefined;
};

function getClientEnv(): z.infer<typeof clientEnvSchema> {
  if (globalForClientEnv.parsedClientEnv) {
    return globalForClientEnv.parsedClientEnv;
  }

  const _env = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  };

  const result = clientEnvSchema.safeParse(_env);

  if (!result.success) {
    // During build, use defaults
    const defaults: Record<string, string> = {
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_POSTHOG_KEY: "phc_placeholder",
      NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_placeholder",
    };

    const envWithDefaults = { ..._env };
    for (const [key, value] of Object.entries(defaults)) {
      if (!envWithDefaults[key as keyof typeof _env]) {
        (envWithDefaults as Record<string, string | undefined>)[key] = value;
      }
    }

    const fallbackResult = clientEnvSchema.safeParse(envWithDefaults);
    if (!fallbackResult.success) {
      console.error(
        "Invalid client environment variables:",
        JSON.stringify(fallbackResult.error.flatten().fieldErrors),
      );
      throw new Error("Invalid client environment variables");
    }

    globalForClientEnv.parsedClientEnv = fallbackResult.data;
    return fallbackResult.data;
  }

  globalForClientEnv.parsedClientEnv = result.data;
  return result.data;
}

const env = new Proxy({} as z.infer<typeof clientEnvSchema>, {
  get(_target, prop: string) {
    return getClientEnv()[prop as keyof z.infer<typeof clientEnvSchema>];
  },
  has(_target, prop: string) {
    return prop in getClientEnv();
  },
  ownKeys() {
    return Reflect.ownKeys(getClientEnv());
  },
  getOwnPropertyDescriptor() {
    return {
      enumerable: true,
      configurable: true,
    };
  },
});

export { env, getClientEnv };
