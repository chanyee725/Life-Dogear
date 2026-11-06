import { expect, test, type Page } from "@playwright/test";
import { deleteCurrentItem, uniqueTitle } from "./helpers";

const editor = (page: Page) => page.getByRole("textbox", { name: "본문" });
const menu = (page: Page) => page.getByRole("listbox", { name: "블록 넣기" });

test("열: /2로 넣고 양쪽에 쓰면 저장 후 새로고침해도 그대로", async ({ page }) => {
  const title = uniqueTitle("열 노트");
  await page.goto("/notes/new");
  await page.getByLabel("제목", { exact: true }).fill(title);
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/notes\/(?!new)[^/]+$/, { timeout: 20_000 });

  await editor(page).click();
  await page.keyboard.type("/2");
  await expect(menu(page).getByRole("option")).toHaveText(["▥2열"]);
  await page.keyboard.press("Enter");
  await expect(menu(page)).toBeHidden();

  const columns = editor(page).locator('[data-type="columns"] > [data-type="column"]');
  await expect(columns).toHaveCount(2);

  // The cursor starts in the first column; click the second to move there.
  await page.keyboard.type("왼쪽 글");
  await columns.nth(1).click();
  await page.keyboard.type("오른쪽 글");
  await expect(columns.nth(0)).toHaveText("왼쪽 글");
  await expect(columns.nth(1)).toHaveText("오른쪽 글");

  // Detail pages save on their own.
  await expect(page.getByText("저장됨", { exact: true })).toBeVisible({ timeout: 20_000 });

  await page.reload();
  await expect(columns).toHaveCount(2);
  await expect(columns.nth(0)).toHaveText("왼쪽 글");
  await expect(columns.nth(1)).toHaveText("오른쪽 글");
  // Side by side on a wide screen: same row, left before right.
  const [a, b] = await Promise.all([columns.nth(0).boundingBox(), columns.nth(1).boundingBox()]);
  expect(Math.abs(a!.y - b!.y)).toBeLessThanOrEqual(2);
  expect(b!.x).toBeGreaterThan(a!.x + a!.width - 1);

  await deleteCurrentItem(page);
  await expect(page).toHaveURL(/\/notes$/);
});
