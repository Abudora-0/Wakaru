import { defineConfig } from "vitest/config";

/**
 * Live provider checks. Separate from the default config because these hit the
 * real free endpoints, so they belong to a deliberate command rather than to
 * the normal test run.
 */
export default defineConfig({
  test: {
    include: ["**/*.live.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
