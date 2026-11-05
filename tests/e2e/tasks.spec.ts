import { expect, test } from "@playwright/test";
import { createItem, uniqueTitle } from "./helpers";

test("할 일: 추가 → 완료하면 포커스가 다음 행으로, 소속별 탭이 열린다", async ({ page }) => {
  await createItem(page, "projects", uniqueTitle("E2E 할 일 프로젝트"));
  // Empty 할 일 section is hidden: reveal it from the notes header.
  await page.getByRole("button", { name: "＋ 할 일", exact: true }).click();
  const input = page.getByRole("textbox", { name: "새 할 일" });
  for (const name of ["첫 할 일", "둘째 할 일"]) {
    await input.fill(name);
    await input.press("Enter");
    // Generous: on a fresh dev server the first add waits for the action to compile.
    await expect(page.getByRole("checkbox", { name: `완료: ${name}` })).toBeVisible({
      timeout: 20_000,
    });
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

test("할 일: 마지막 할 일을 지워도 섹션이 남고 되돌리기로 복원된다", async ({ page }) => {
  await createItem(page, "projects", uniqueTitle("E2E 마지막 할 일 삭제"));
  await page.getByRole("button", { name: "＋ 할 일", exact: true }).click();
  const input = page.getByRole("textbox", { name: "새 할 일" });
  await input.fill("유일한 할 일");
  await input.press("Enter");
  await expect(page.getByRole("checkbox", { name: "완료: 유일한 할 일" })).toBeVisible({
    timeout: 20_000,
  });
  // Reopen the page with one task: the section is now shown from the first render.
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "완료: 유일한 할 일" })).toBeVisible();

  await page.getByRole("button", { name: "할 일 메뉴: 유일한 할 일" }).click();
  await page.getByRole("menuitem", { name: "삭제" }).click();
  await expect(page.getByText("‘유일한 할 일’을 지웠습니다.")).toBeVisible();
  // The now-empty section stays mounted, so the undo toast survives the refresh.
  await expect(page.getByRole("button", { name: "되돌리기" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "완료: 유일한 할 일" })).toHaveCount(0);
  await page.getByRole("button", { name: "되돌리기" }).click();
  await expect(page.getByRole("checkbox", { name: "완료: 유일한 할 일" })).toBeVisible({
    timeout: 20_000,
  });
});
