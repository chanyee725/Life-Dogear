import { expect, test } from "@playwright/test";
import { deleteCurrentItem, uniqueTitle } from "./helpers";

test("goals list: life card, filter bar, goal row with level badge and days left", async ({
  page,
}) => {
  const title = uniqueTitle("E2E 연 목표");
  await page.goto("/goals/new?horizon=year");
  await page.getByLabel("제목", { exact: true }).fill(title);
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/goals\/(?!new)[^/]+$/, { timeout: 20_000 });
  const detailUrl = page.url();

  await page.goto("/goals?period=year");
  const filters = page.getByRole("radiogroup", { name: "기간" });
  await expect(filters.getByRole("radio", { name: "올해" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.getByRole("combobox", { name: "영역" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "목표 찾기" })).toBeVisible();

  const row = page.getByRole("listitem").filter({ hasText: title });
  await expect(row.getByText("연", { exact: true })).toBeVisible();
  await expect(row.getByText(/^(D-\d+|D-day)$/)).toBeVisible();

  await filters.getByRole("radio", { name: "전체" }).click();
  await expect(page).toHaveURL(/period=all/);
  await expect(row).toBeVisible();

  await page.goto(detailUrl);
  await deleteCurrentItem(page);
  await expect(page).toHaveURL(/\/goals$/);
});
