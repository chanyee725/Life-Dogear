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
  await expect(menu(page).getByRole("option").first()).toHaveText("▥2열");
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

test("열: 경계 핸들을 끌어 비율을 바꾸면 새로고침 뒤에도 유지되고, 더블클릭하면 균등으로 돌아온다", async ({
  page,
}) => {
  const title = uniqueTitle("열 비율");
  await page.goto("/notes/new");
  await page.getByLabel("제목", { exact: true }).fill(title);
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/notes\/(?!new)[^/]+$/, { timeout: 20_000 });

  await editor(page).click();
  await page.keyboard.type("/2");
  await page.keyboard.press("Enter");
  const columns = editor(page).locator('[data-type="columns"] > [data-type="column"]');
  await expect(columns).toHaveCount(2);
  await page.keyboard.type("왼쪽 글");
  await columns.nth(1).click();
  await page.keyboard.type("오른쪽 글");

  const ratio = async () => {
    const [a, b] = await Promise.all([columns.nth(0).boundingBox(), columns.nth(1).boundingBox()]);
    return a!.width / (a!.width + b!.width);
  };
  expect(Math.abs((await ratio()) - 0.5)).toBeLessThan(0.05);

  // One handle between two columns: a vertical bar. Drag it to the right.
  const handle = page.getByTestId("column-resize-handle");
  await columns.nth(0).hover();
  await expect(handle).toHaveCount(1);
  const grip = (await handle.boundingBox())!;
  const [left] = await Promise.all([columns.nth(0).boundingBox()]);
  expect(grip.height).toBeGreaterThan(grip.width); // vertical bar
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 + left!.width * 0.3, grip.y + grip.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  await expect.poll(ratio).toBeGreaterThan(0.6);
  const dragged = await ratio();
  await expect(page.locator('input[type="hidden"][name="body"]')).toHaveValue(/::: column \d+\n/);
  await expect(page.getByText("저장됨", { exact: true })).toBeVisible({ timeout: 20_000 });

  await page.reload();
  await expect(columns).toHaveCount(2);
  expect(Math.abs((await ratio()) - dragged)).toBeLessThan(0.03);
  await expect(columns.nth(0)).toHaveText("왼쪽 글");

  // Double click resets to equal columns and drops the widths from the Markdown.
  await columns.nth(0).hover();
  await page.getByTestId("column-resize-handle").dblclick();
  await expect.poll(async () => Math.abs((await ratio()) - 0.5)).toBeLessThan(0.05);
  await expect(page.locator('input[type="hidden"][name="body"]')).not.toHaveValue(/::: column \d+/);

  await deleteCurrentItem(page);
  await expect(page).toHaveURL(/\/notes$/);
});
