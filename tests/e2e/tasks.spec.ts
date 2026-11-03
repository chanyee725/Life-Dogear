import { expect, test } from "@playwright/test";
import { createItem, uniqueTitle } from "./helpers";

test("할 일: 추가 → 완료하면 포커스가 다음 행으로, 소속별 탭이 열린다", async ({ page }) => {
  await createItem(page, "projects", uniqueTitle("E2E 할 일 프로젝트"));
  await page.getByRole("button", { name: "＋ 할 일 추가" }).click();
  const input = page.getByRole("textbox", { name: "새 할 일" });
  for (const name of ["첫 할 일", "둘째 할 일"]) {
    await input.fill(name);
    await input.press("Enter");
    await expect(page.getByRole("checkbox", { name: `완료: ${name}` })).toBeVisible();
  }

  // Space on the first checkbox: the row moves to 완료 and focus goes to the next row.
  const first = page.getByRole("checkbox", { name: "완료: 첫 할 일" });
  await first.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("checkbox", { name: "완료: 둘째 할 일" })).toBeFocused();

  // Last open one: focus falls to the add line.
  await page.keyboard.press("Space");
  await expect(page.locator("[data-task-add]")).toBeFocused();
  await expect(page.getByRole("button", { name: /완료 2/ })).toBeVisible();

  const res = await page.goto("/tasks?tab=by-parent");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "소속 없음 0" })).toBeVisible();
});
