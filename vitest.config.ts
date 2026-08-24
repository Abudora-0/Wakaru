import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration specs hit the real free APIs. They are excluded from the
    // default run so that a normal "npm test" never depends on the network,
    // never burns a daily quota and never fails because a provider is down.
    // Run them deliberately with: npm run test:live
    // e2e holds Playwright specs, which have their own runner and their own
    // config. Vitest must not try to collect them.
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.live.test.ts", "e2e/**"],
  },
});
