import { defineConfig, devices } from "@playwright/test";

/**
 * End to end configuration.
 *
 * The suite runs against a production build on its own port, so it never
 * collides with a dev server someone has open, and it never depends on the
 * dev overlay or on Fast Refresh timing.
 *
 * Every test intercepts the provider routes. That is deliberate: these specs
 * are about the interface, and the real providers are covered by
 * "npm run test:live". Mocking here keeps the suite deterministic, keeps it
 * fast, and stops CI from spending a free daily quota on every push.
 */

const PORT = 3123;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      // Specs tagged live need a real upstream, so they are opt in.
      grepInvert: /@live/,
      // The narrow layout has its own project below.
      testIgnore: /responsive.spec.ts/,
    },
    {
      // The spread folds into stacked panels below 900px, and the masthead
      // sheds its tagline, so the narrow layout is worth exercising too.
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /responsive\.spec\.ts/,
    },
  ],

  webServer: {
    command: `npm run start --workspace @wakaru/web -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
