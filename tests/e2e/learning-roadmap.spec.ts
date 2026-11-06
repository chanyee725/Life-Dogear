import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";

// Fixture follows the roadmap JSON contract ({slug,title,topic,summary,stages[{items[{children}]}]}).
// If the importer's own fixtures dir lands later, point FIXTURE at it instead of this copy.
const FIXTURE = path.join(process.cwd(), "tests", "e2e", "fixtures", "learning-roadmap.json");
const ITEM = "E2E 필수 항목";

test.beforeAll(() => {
  // Same data dir the e2e web server uses (playwright.config.ts), so /roadmap sees the import.
  execFileSync("npm", ["run", "roadmap:import", "--", FIXTURE], {
    cwd: process.cwd(),
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
  const item = (t: string) => page.locator('button[data-testid^="rm-item-"]').filter({ hasText: t });

  await expect(stage("E2E 1단계 기초")).toBeVisible();
  await expect(stage("E2E 2단계 심화")).toBeVisible();
  await expect(item(ITEM)).toBeVisible();
  await expect(item("E2E 권장 항목")).toBeVisible();

  // Clicking the item opens the ItemPanel (impl-275); its done button sets the status.
  await item(ITEM).click();
  const panel = page.getByTestId("rm-item-panel");
  await expect(panel).toBeVisible();
  await page.getByTestId("rm-status-btn-done").click();
  await expect(panel).toHaveAttribute("data-status", "done");

  await page.reload();
  await item(ITEM).click();
  await expect(page.getByTestId("rm-item-panel")).toHaveAttribute("data-status", "done");
});

const stageOf = (page: import("@playwright/test").Page, t: string) =>
  page.locator('[data-testid^="rm-stage-"]').filter({ hasText: t }).first();

test("/roadmap: 트리 DOM 구조, 단계 접힘/펼침", async ({ page }) => {
  await page.goto("/roadmap");
  const tree = page.getByTestId("rm-tree");
  await expect(tree).toHaveAttribute("role", "tree");
  await expect(tree.locator("li.rt-node[role=treeitem][data-id]").first()).toBeVisible();

  const stage = stageOf(page, "E2E 2단계 심화");
  const item = page.locator('button[data-testid^="rm-item-"]').filter({ hasText: "E2E 선택 항목" });
  await expect(item).toBeVisible(); // 단계는 기본 펼침

  const toggle = stage.locator("button.rt-stage-label").first();
  await toggle.click();
  await expect(item).toBeHidden();
  await expect(stage).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(item).toBeVisible();
  await expect(stage).toHaveAttribute("aria-expanded", "true");
});

test("/roadmap: 항목 클릭 시 옆 패널에 해당 항목 표시", async ({ page }) => {
  await page.goto("/roadmap");
  await page.locator('button[data-testid^="rm-item-"]').filter({ hasText: "E2E 권장 항목" }).click();
  const panel = page.getByTestId("rm-item-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("E2E 권장 항목");
});

test("/roadmap: 키보드 ↓ 이동, → 펼치기, ← 접기, Enter 패널", async ({ page }) => {
  await page.goto("/roadmap");
  const stage = stageOf(page, "E2E 1단계 기초");
  await expect(stage).toBeVisible();

  await stage.focus();
  await page.keyboard.press("ArrowLeft"); // 열린 단계 접기
  await expect(stage).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("ArrowRight"); // 다시 펼치기
  await expect(stage).toHaveAttribute("aria-expanded", "true");

  await page.keyboard.press("ArrowDown"); // 첫 항목으로 이동
  const focusedId = await page.evaluate(() => document.activeElement?.closest("li.rt-node")?.getAttribute("data-id"));
  expect(focusedId).toBeTruthy();
  expect(focusedId).not.toBe(await stage.getAttribute("data-id"));

  await page.keyboard.press("Enter");
  await expect(page.getByTestId("rm-item-panel")).toBeVisible();
});
