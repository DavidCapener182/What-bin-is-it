import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  expect: {
    timeout: 8_000,
    toHaveScreenshot: { animations: "disabled" },
  },
  fullyParallel: true,
  outputDir: "test-results",
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  snapshotPathTemplate: "{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}-{projectName}{ext}",
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:3011",
    colorScheme: "light",
    contextOptions: { reducedMotion: "reduce" },
    locale: "en-GB",
    screenshot: "only-on-failure",
    timezoneId: "UTC",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx --no-install next dev --hostname 127.0.0.1 --port 3011",
    env: { ...process.env, COUNCIL_E2E_FIXTURES: "1", TZ: "UTC" },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: "http://127.0.0.1:3011/console-test-fixture",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["iPhone 13"], browserName: "chromium" } },
  ],
});
