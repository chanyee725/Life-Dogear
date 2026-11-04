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
    // Dedicated data dir (DB + PDFs) so the run never touches data/local.db or data/pdfs.
    // Wipe and recreate the e2e data folder so every run starts from a fresh DB + PDFs.
    command:
      "node -e \"require('fs').rmSync('data/e2e',{recursive:true,force:true});require('fs').mkdirSync('data/e2e',{recursive:true})\" && npm run db:migrate && npm run db:seed && npm run dev",
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATA_DIR: "data/e2e",
      DATABASE_URL: "file:./data/e2e/e2e.db",
      DATABASE_AUTH_TOKEN: "",
      // Never write test photos and PDFs to the shared bucket.
      BLOB_STORE: "local",
      // Test-only server hooks (e.g. the home calendar delay cookie).
      E2E_HOOKS: "1",
    },
  },
});
