import { expect, test } from "@playwright/test";
import { createItem, deleteCurrentItem, uniqueTitle } from "./helpers";

test("논문 보관: 목록·홈에서 빠지고, 보관 해제하면 돌아온다", async ({ page }) => {
  const title = uniqueTitle("E2E archive paper");
  await createItem(page, "papers", title);
  const detail = page.url();

  await page.getByRole("button", { name: "보관", exact: true }).click();
  // First archive click can wait on a cold dev-server compile; give it more than the 5s default.
  await expect(page.getByRole("button", { name: "보관 해제" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("보관된 논문입니다.")).toBeVisible();

  await page.goto("/papers");
  await expect(page.getByText(title)).toHaveCount(0);

  await page.goto(detail);
  await page.getByRole("button", { name: "보관 해제" }).click();
  await expect(page.getByRole("button", { name: "보관", exact: true })).toBeVisible();
  await page.goto("/papers");
  await expect(page.getByText(title).first()).toBeVisible();

  await page.goto(detail);
  await deleteCurrentItem(page);
  await expect(page).toHaveURL(/\/papers$/);
});
