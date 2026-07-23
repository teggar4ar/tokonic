import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    exclude: ["tests/unit/**", "node_modules/**", ".next/**"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    retry: 0,
  },
});
