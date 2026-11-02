import { defineConfig, devices } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    locale: "ko-KR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Dedicated DB so the run never touches data/local.db. Seed resets only `seed-*` rows.
    command: "npm run db:migrate && npm run db:seed && npm run dev",
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { DATABASE_URL: "file:./data/e2e.db", DATABASE_AUTH_TOKEN: "" },
  },
});
