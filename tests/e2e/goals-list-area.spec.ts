import { expect, test, type Page } from "@playwright/test";
import { deleteCurrentItem, pickOption, uniqueTitle } from "./helpers";

const AREA = "연구 분야";

async function createGoal(page: Page, title: string, status: "진행 중" | "달성") {
  await page.goto("/goals/new?horizon=year");
  await page.getByLabel("제목", { exact: true }).fill(title);
  await pickOption(page, page.locator("#goal-area"), AREA);
  await pickOption(page, page.locator("#goal-status"), status);
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/goals\/(?!new)[^/]+$/, { timeout: 20_000 });
  return page.url();
}

test("goals list: area name only on ended rows, not under its own area heading", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const active = uniqueTitle("E2E 영역 진행");
  const ended = uniqueTitle("E2E 영역 끝남");
  const activeUrl = await createGoal(page, active, "진행 중");
  const endedUrl = await createGoal(page, ended, "달성");

  await page.goto("/goals?period=all");
  const group = page.getByRole("region", { name: new RegExp(`^${AREA}`) });
  const activeRow = group.getByRole("listitem").filter({ hasText: active });
  await expect(activeRow).toBeVisible();
  await expect(activeRow.getByText(AREA, { exact: true })).toHaveCount(0);

  await page.locator("summary", { hasText: "끝난 목표" }).click();
  const endedRow = page.getByRole("listitem").filter({ hasText: ended });
  await expect(endedRow.getByText(AREA, { exact: true })).toBeVisible();

  for (const url of [activeUrl, endedUrl]) {
    await page.goto(url);
    await deleteCurrentItem(page);
    await expect(page).toHaveURL(/\/goals$/);
  }
});
