import { expect, test, type Page } from "@playwright/test";
import { createItem, uniqueTitle } from "./helpers";

const sidebar = (page: Page) => page.getByRole("navigation", { name: "주 메뉴" });

// Seed has four areas named like the recommended ones; remove them so the sidebar
// offers the recommendations. The e2e database is recreated on every run.
test("영역이 없으면 추천 영역을 골라 만든다", async ({ page }) => {
  await page.goto("/areas");
  for (;;) {
    const first = page.locator("main ul a[href^='/areas/']").first();
    if ((await first.count()) === 0) break;
    await first.click();
    await page.getByRole("button", { name: "삭제", exact: true }).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "삭제" }).click();
    await expect(page).toHaveURL(/\/areas$/);
  }

  await expect(sidebar(page).getByText("추천 영역", { exact: true })).toBeVisible();
  await sidebar(page).getByLabel("건강").check();
  await sidebar(page).getByLabel("학위").check();
  await sidebar(page).getByRole("button", { name: "선택한 영역 만들기" }).click();

  // The sidebar has a single 영역 entry: the picker goes away and the areas list shows them.
  await expect(sidebar(page).getByText("추천 영역", { exact: true })).toHaveCount(0);
  await page.goto("/areas");
  const list = page.locator("main ul");
  await expect(list.getByRole("link", { name: /건강/ })).toBeVisible();
  await expect(list.getByRole("link", { name: /학위/ })).toBeVisible();
  await expect(list.getByRole("link", { name: /커리어/ })).toHaveCount(0);
});

test("보관 → 보관함 → 보관 해제", async ({ page }) => {
  const title = uniqueTitle("E2E archive");
  await createItem(page, "thoughts", title);

  await page.getByRole("button", { name: "보관", exact: true }).click();
  await expect(page).toHaveURL(/\/thoughts$/);
  await expect(page.getByText(title)).toHaveCount(0);

  await sidebar(page).getByRole("link", { name: "보관함" }).click();
  const row = page.getByRole("listitem").filter({ hasText: title });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "보관 해제" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: title })).toHaveCount(0);

  await page.goto("/thoughts");
  await expect(page.getByText(title).first()).toBeVisible();
});

test("수집함: 태그를 달면 정리되어 빠진다", async ({ page }) => {
  const title = uniqueTitle("E2E inbox");
  await createItem(page, "thoughts", title);

  await sidebar(page)
    .getByRole("link", { name: /^수집함/ })
    .click();
  await expect(page).toHaveURL(/\/inbox$/);
  const row = page.getByRole("listitem").filter({ hasText: title });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "태그 달기" }).click();
  const tagBox = row.getByPlaceholder("태그 입력 후 Enter");
  await tagBox.fill("정리됨");
  await tagBox.press("Enter");
  await row.getByRole("button", { name: "태그 저장" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: title })).toHaveCount(0);
});

test("수집함: 삭제는 확인 후 생각을 아예 지운다", async ({ page }) => {
  const title = uniqueTitle("E2E inbox delete");
  await createItem(page, "thoughts", title);

  await page.goto("/inbox");
  const row = page.getByRole("listitem").filter({ hasText: title });
  await expect(row).toBeVisible();

  // Cancelling keeps it.
  await row.getByRole("button", { name: "삭제", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "취소" }).click();
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "삭제", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "삭제" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: title })).toHaveCount(0);

  // Gone everywhere, not just filed away.
  await page.goto("/thoughts");
  await expect(page.getByText(title)).toHaveCount(0);
  await page.goto("/archive");
  await expect(page.getByText(title)).toHaveCount(0);
});
