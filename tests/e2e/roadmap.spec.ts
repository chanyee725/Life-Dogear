import { expect, test, type Page } from "@playwright/test";
import { deleteCurrentItem, pickOption, uniqueTitle } from "./helpers";

const AREA = "연구 분야";

/** Saves a goal form already filled in; resolves with the detail URL. */
async function saveGoal(page: Page, title: string) {
  await page.getByLabel("제목", { exact: true }).fill(title);
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/goals\/(?!new)[^/]+$/, { timeout: 20_000 });
  return page.url();
}

/** Id part of a node's data-testid (`roadmap-node-{kind}-{id}`). */
async function nodeId(page: Page, kind: string, title: string) {
  const node = page.locator(`[data-testid^="roadmap-node-${kind}-"]`).filter({ hasText: title });
  await expect(node).toHaveCount(1);
  const testid = (await node.getAttribute("data-testid"))!;
  return testid.slice(`roadmap-node-${kind}-`.length);
}

test("/roadmap: 영역·목표·프로젝트 노드, 프로젝트 클릭 이동, 접기·펼치기", async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1400, height: 900 });
  const goalTitle = uniqueTitle("E2E 로드맵 목표");
  const subTitle = uniqueTitle("E2E 로드맵 하위");
  const projTitle = uniqueTitle("E2E 로드맵 프로젝트");
  const taskTitle = uniqueTitle("로드맵 할 일");

  // Seed: goal in the area → sub goal under it → project under the sub goal → one task.
  await page.goto("/goals/new?horizon=year");
  await pickOption(page, page.locator("#goal-area"), AREA);
  const goalUrl = await saveGoal(page, goalTitle);
  const subHref = await page
    .getByRole("region", { name: "하위 목표" })
    .getByRole("link", { name: "＋ 새 하위 목표" })
    .getAttribute("href");
  await page.goto(subHref!);
  const subUrl = await saveGoal(page, subTitle);
  const projHref = await page
    .getByRole("region", { name: "프로젝트" })
    .getByRole("link", { name: "＋ 새 프로젝트" })
    .getAttribute("href");
  await page.goto(projHref!);
  await page.getByLabel("제목", { exact: true }).fill(projTitle);
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/projects\/(?!new)[^/]+$/, { timeout: 20_000 });
  const projUrl = page.url();
  await page.getByRole("button", { name: "＋ 할 일", exact: true }).click();
  const input = page.getByRole("textbox", { name: "새 할 일" });
  await input.fill(taskTitle);
  await input.press("Enter");
  await expect(page.getByRole("checkbox", { name: `완료: ${taskTitle}` })).toBeVisible({
    timeout: 20_000,
  });

  // /roadmap: area, goals and project nodes are visible; project tasks start collapsed.
  await page.goto("/roadmap");
  await expect(page.locator('[data-testid^="roadmap-node-area-"]').first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.locator('[data-testid^="roadmap-node-area-"]').filter({ hasText: AREA }),
  ).toHaveCount(1);
  const goalNode = page
    .locator('[data-testid^="roadmap-node-goal-"]')
    .filter({ hasText: goalTitle });
  const subNode = page.locator('[data-testid^="roadmap-node-goal-"]').filter({ hasText: subTitle });
  const projNode = page
    .locator('[data-testid^="roadmap-node-project-"]')
    .filter({ hasText: projTitle });
  const taskNode = page
    .locator('[data-testid^="roadmap-node-task-"]')
    .filter({ hasText: taskTitle });
  await expect(goalNode).toBeVisible();
  await expect(subNode).toBeVisible();
  await expect(projNode).toBeVisible();
  await expect(taskNode).toHaveCount(0);

  // Clicking the project node opens its detail page; back returns to the roadmap.
  await projNode.click();
  await expect(page).toHaveURL(projUrl, { timeout: 20_000 });
  await page.goBack();
  await expect(page).toHaveURL(/\/roadmap$/);
  await expect(projNode).toBeVisible();

  // Project toggle: expand shows the task, collapse hides it again.
  const projToggle = page.getByTestId(
    `roadmap-toggle-project-${await nodeId(page, "project", projTitle)}`,
  );
  await projToggle.click();
  await expect(taskNode).toBeVisible();
  await projToggle.click();
  await expect(taskNode).toHaveCount(0);

  // Goal toggle: collapsing the goal hides its sub goal and project; expanding restores them.
  const goalToggle = page.getByTestId(
    `roadmap-toggle-goal-${await nodeId(page, "goal", goalTitle)}`,
  );
  await goalToggle.click();
  await expect(subNode).toHaveCount(0);
  await expect(projNode).toHaveCount(0);
  await expect(goalNode).toBeVisible();
  await goalToggle.click();
  await expect(subNode).toBeVisible();
  await expect(projNode).toBeVisible();

  // Clean up what this test made.
  for (const url of [projUrl, subUrl, goalUrl]) {
    await page.goto(url);
    await deleteCurrentItem(page);
  }
});
