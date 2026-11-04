import { expect, test } from "@playwright/test";
import { deleteCurrentItem, uniqueTitle } from "./helpers";

// A title typed before the detail page hydrates used to become the autosave baseline
// and was never saved.
test("title typed before hydration is saved", async ({ page }) => {
  test.setTimeout(90_000);
  const title = uniqueTitle("E2E 하이드레이션 목표");
  await page.goto("/goals/new?horizon=year");
  await page.getByLabel("제목", { exact: true }).fill(title);
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/goals\/(?!new)[^/]+$/, { timeout: 20_000 });
  const url = page.url();

  const renamed = `${title} 수정`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.getByLabel("제목", { exact: true }).fill(renamed);
  await expect(page.locator('[data-state="saved"]')).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await expect(page.getByLabel("제목", { exact: true })).toHaveValue(renamed);

  await deleteCurrentItem(page);
  await expect(page).toHaveURL(/\/goals$/);
});
