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
        lines: 60,
        functions: 50,
        branches: 50,
        statements: 60,
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
