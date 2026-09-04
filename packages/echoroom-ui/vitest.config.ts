import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
  esbuild: {
    jsx: "automatic",
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
