import { defineConfig, devices } from "@playwright/test";

// `E2E_PROD=1 npx playwright test`: run against a production build (next build + next start,
// output in .next-e2e) instead of next dev, so pages skip the per-page first compile.
// Another dev server often holds 3000: pick a free port with `E2E_PORT=3464 npx playwright test`
// instead of copying this file (a copy easily loses the web server env below, e.g. E2E_HOOKS).
const PORT = process.env.E2E_PORT ?? "3000";
const BASE_URL = `http://127.0.0.1:${PORT}`;
// `E2E_GOOGLE_WRITE=1`: the web server gets dummy Google write keys so '일정 추가' is enabled
// (tests/e2e/calendar-add-event.spec.ts). The tests answer POST /api/calendar/events
// themselves, so nothing reaches Google. Off by default: googleWrite stays false.
const GOOGLE_WRITE_ENV: Record<string, string> =
  process.env.E2E_GOOGLE_WRITE === "1"
    ? {
        GOOGLE_OAUTH_CLIENT_ID: "test",
        GOOGLE_OAUTH_CLIENT_SECRET: "test",
        GOOGLE_OAUTH_REFRESH_TOKEN: "test",
      }
    : {};
const PROD = process.env.E2E_PROD === "1";
// Fresh e2e data folder (DB + PDFs), migrated and seeded, before either server starts.
const RESET_DB =
  "node -e \"require('fs').rmSync('data/e2e',{recursive:true,force:true});require('fs').mkdirSync('data/e2e',{recursive:true})\" && npm run db:migrate && npm run db:seed";
// `-p`: if the port is taken, fail instead of Next quietly moving to the next port.
// Prod builds into .next-e2e (NEXT_DIST_DIR, see next.config.ts) so it never clobbers the
// dev .next or the `npm run serve` .next-prod; the env below reaches both build and start.
const SERVER = PROD
  ? `npx next build && npx next start -H 127.0.0.1 -p ${PORT}`
  : `npm run dev -- -p ${PORT}`;

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
    command: `${RESET_DB} && ${SERVER}`,
    url: BASE_URL,
    reuseExistingServer: false,
    // A production build takes a few minutes before the server is up.
    timeout: PROD ? 600_000 : 180_000,
    env: {
      DATA_DIR: "data/e2e",
      DATABASE_URL: "file:./data/e2e/e2e.db",
      DATABASE_AUTH_TOKEN: "",
      // Never write test photos and PDFs to the shared bucket.
      BLOB_STORE: "local",
      // Test-only server hooks (e.g. the home calendar delay cookie).
      E2E_HOOKS: "1",
      ...(PROD ? { NEXT_DIST_DIR: ".next-e2e" } : {}),
      ...GOOGLE_WRITE_ENV,
    },
  },
});
