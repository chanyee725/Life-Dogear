import { expect, test } from "@playwright/test";
import { deleteCurrentItem, uniqueTitle } from "./helpers";

test("goals list: a goal-less year in the URL shows in the year select, no period chip checked", async ({
  page,
}) => {
  test.setTimeout(120_000);
  // The filter bar needs at least one goal; this year's, so 2030 stays goal-less.
  await page.goto("/goals/new?horizon=year");
  await page.getByLabel("제목", { exact: true }).fill(uniqueTitle("E2E 기간 목표"));
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/goals\/(?!new)[^/]+$/, { timeout: 20_000 });
  const detailUrl = page.url();

  await page.goto("/goals?period=2030");
  const year = page.getByRole("combobox", { name: "다른 연도" });
  await expect(year).toBeVisible();
  await expect(year).toHaveValue("2030");

  const filters = page.getByRole("radiogroup", { name: "기간" });
  for (const name of ["올해", "이번 분기"]) {
    await expect(filters.getByRole("radio", { name })).toHaveAttribute("aria-checked", "false");
  }

  await page.goto(detailUrl);
  await deleteCurrentItem(page);
  await expect(page).toHaveURL(/\/goals$/);
});
