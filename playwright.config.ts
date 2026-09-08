import { defineConfig, devices } from "@playwright/test";

/**
 * End to end configuration.
 *
 * The suite runs against a production build on its own port, so it never
 * collides with a dev server someone has open, and it never depends on the
 * dev overlay or on Fast Refresh timing.
 *
 * next start only serves whatever is already sitting in .next, it never
 * rebuilds, and reuseExistingServer below means a stale build gets reused
 * silently rather than refused. The root package.json's pree2e hook rebuilds
 * before every `npm run e2e`, but that hook only fires for the npm script:
 * calling `npx playwright test` directly skips it and can validate against
 * code that no longer matches the source tree with no warning at all. Build
 * first (`npm run build --workspace @wakaru/web`) before reaching for
 * `npx playwright test` by hand.
 *
 * Most specs mock the provider routes they touch, so the interface is what is
 * under test rather than a live upstream. A few pages call the provider chain
 * directly from server rendering rather than over a mockable route, and those
 * specs accept a real network round trip with a wider timeout instead. Specs
 * that need a real upstream on purpose, rather than by necessity, are tagged
 * @live and excluded here, covered by "npm run e2e:live" instead.
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
