import { expect, test } from "@playwright/test";
import { deleteCurrentItem, uniqueTitle } from "./helpers";

/**
 * Date fields show YYYY.MM.DD like every other date: typed by keyboard or picked from the
 * calendar popover, saved as YYYY-MM-DD.
 */
test("날짜 칸: YYYY.MM.DD 입력·달력 선택·지우기", async ({ page }) => {
  await page.goto("/seminars/new");
  await page.getByLabel("제목", { exact: true }).fill(uniqueTitle("E2E 날짜 칸"));
  const date = page.getByLabel("날짜", { exact: true });

  await date.pressSequentially("2026.11.04");
  await expect(date).toHaveValue("2026.11.04");

  // Clearing leaves it empty; a calendar pick fills it back in the same format.
  await date.fill("");
  await date.blur();
  await expect(date).toHaveValue("");
  await date.fill("2026.11.04");
  await page.getByRole("button", { name: "달력에서 고르기" }).click();
  const calendar = page.locator("[data-slot=calendar]");
  await expect(calendar).toBeVisible();
  await calendar.locator("button", { hasText: /^20$/ }).click();
  await expect(calendar).toHaveCount(0);
  await expect(date).toHaveValue("2026.11.20");
  await expect(date).toBeFocused();

  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/seminars\/(?!new)[^/]+$/, { timeout: 20_000 });
  await expect(page.getByLabel("날짜", { exact: true })).toHaveValue("2026.11.20");

  await deleteCurrentItem(page);
  await expect(page).toHaveURL(/\/seminars$/, { timeout: 20_000 });
});
