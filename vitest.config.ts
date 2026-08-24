import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration specs hit the real free APIs. They are excluded from the
    // default run so that a normal "npm test" never depends on the network,
    // never burns a daily quota and never fails because a provider is down.
    // Run them deliberately with: npm run test:live
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.live.test.ts"],
  },
});
