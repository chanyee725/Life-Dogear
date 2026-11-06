import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";

// Fixture follows the roadmap JSON contract ({slug,title,topic,summary,stages[{items[{children}]}]}).
// If the importer's own fixtures dir lands later, point FIXTURE at it instead of this copy.
const FIXTURE = path.join(__dirname, "fixtures", "learning-roadmap.json");
const ITEM = "E2E 필수 항목";

test.beforeAll(() => {
  // Same data dir the e2e web server uses (playwright.config.ts), so /roadmap sees the import.
  execFileSync("npm", ["run", "roadmap:import", "--", FIXTURE], {
    cwd: path.join(__dirname, "..", ".."),
    stdio: "inherit",
    env: {
      ...process.env,
      DATA_DIR: "data/e2e",
      DATABASE_URL: "file:./data/e2e/e2e.db",
      DATABASE_AUTH_TOKEN: "",
      BLOB_STORE: "local",
    },
  });
});

test("/roadmap: 가져온 단계·항목 표시, 항목 클릭으로 done, 새로고침 후 유지", async ({ page }) => {
  test.slow();
  await page.goto("/roadmap");

  const stage = (t: string) => page.locator('[data-testid^="rm-stage-"]').filter({ hasText: t });
  const item = (t: string) => page.locator('[data-testid^="rm-item-"]').filter({ hasText: t });

  await expect(stage("E2E 1단계 기초")).toBeVisible();
  await expect(stage("E2E 2단계 심화")).toBeVisible();
  await expect(item(ITEM)).toBeVisible();
  await expect(item("E2E 권장 항목")).toBeVisible();

  // TODO(ItemPanel, impl-275): done 판정은 패널 마크업 확정 후 상태 버튼 data-testid로 교체.
  await item(ITEM).click();
  const done = page.locator('[data-status="done"], [aria-checked="true"]').filter({ hasText: ITEM });
  await expect(done.first()).toBeVisible();

  await page.reload();
  await expect(item(ITEM)).toBeVisible();
  await expect(done.first()).toBeVisible();
});
  await expect(done.first()).toBeVisible();

  await page.reload();
  await expect(page.getByText(ITEM)).toBeVisible();
  await expect(done.first()).toBeVisible();
});
