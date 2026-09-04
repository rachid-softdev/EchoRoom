// Force test mode BEFORE anything else: the vitest main process (dep
// optimizer + forked workers) inherits the shell's NODE_ENV, which on
// developer machines can be "production" — that breaks node:crypto /
// node:async_hooks resolution in the optimizer and the whole suite.
// Setting it here (main process) covers both the optimizer and workers.
// (Object.assign: process.env.NODE_ENV is typed readonly in @types/node.)
Object.assign(process.env, { NODE_ENV: "test" });

import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "__tests__/**/*.test.{ts,tsx}"],
    // Increase timeout for slow CI / first-run imports (was 5000ms default)
    testTimeout: 30_000,
    // Use forks for better memory isolation and avoid OOM
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: false,
        isolate: true,
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/__tests__/**",
        "src/types/**",
        "src/**/*.d.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 75,
        branches: 80,
        statements: 80,
      },
    },
  },
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
