import { expect, test, type Page } from "@playwright/test";
import { deleteCurrentItem, uniqueTitle } from "./helpers";

const editor = (page: Page) => page.getByRole("textbox", { name: "본문" });
const columnsOf = (page: Page) =>
  editor(page).locator('[data-type="columns"] > [data-type="column"]');

// Note with N columns: first column "왼쪽 글", last column a numbered list item.
async function setup(page: Page, n: 2 | 3, label: string) {
  await page.goto("/notes/new");
  await page.getByLabel("제목", { exact: true }).fill(uniqueTitle(label));
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/notes\/(?!new)[^/]+$/, { timeout: 20_000 });

  await editor(page).click();
  await page.keyboard.type(`/${n}`);
  await page.keyboard.press("Enter");
  const columns = columnsOf(page);
  await expect(columns).toHaveCount(n);
  await page.keyboard.type("왼쪽 글");
  await columns.nth(n - 1).click();
  await page.keyboard.type("1. 번호 항목");
  await expect(columns.nth(n - 1).locator("ol > li")).toHaveCount(1);
  return columns;
}

for (const n of [2, 3] as const) {
  test(`열 사이 틈: ${n}열 오른쪽 열의 번호 목록 핸들이 틈을 지나도 유지되고 왼쪽 열로 옮겨진다`, async ({
    page,
  }) => {
    const columns = await setup(page, n, `열 틈 ${n}`);
    const item = columns.nth(n - 1).locator("ol > li").first();
    await item.hover();
    const handle = page.getByRole("button", { name: "블록 이동" });
    await expect(handle).toBeVisible();

    // Walk from the item to the handle in small steps; the handle must not vanish on the way.
    const from = (await item.boundingBox())!;
    const grip = (await handle.boundingBox())!;
    const gx = grip.x + grip.width / 2;
    const gy = grip.y + grip.height / 2;
    const sx = from.x + 4;
    const sy = from.y + from.height / 2;
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(sx + ((gx - sx) * i) / steps, sy + ((gy - sy) * i) / steps);
      await expect(handle).toBeVisible();
    }

    // Drag the handle into the left column, below its text.
    const target = (await columns.nth(0).getByText("왼쪽 글", { exact: true }).boundingBox())!;
    await page.mouse.down();
    await page.mouse.move(target.x + 10, target.y + target.height / 2, { steps: 8 });
    await page.mouse.move(target.x + 10, target.y + target.height - 2, { steps: 3 });
    await expect(page.locator(".rb-drop-line")).toBeVisible();
    await page.mouse.up();

    await expect(columns.nth(0)).toContainText("번호 항목");
    await expect(columns.nth(n - 1)).not.toContainText("번호 항목");
    await expect(page.locator('input[type="hidden"][name="body"]')).toHaveValue(
      /::: column\n왼쪽 글\n\n1\. 번호 항목/,
    );

    await expect(page.getByText("저장됨", { exact: true })).toBeVisible({ timeout: 20_000 });
    await deleteCurrentItem(page);
    await expect(page).toHaveURL(/\/notes$/);
  });
}

test("열 사이 틈: 비율 막대를 끌면 여전히 열 비율이 바뀐다", async ({ page }) => {
  const columns = await setup(page, 2, "열 틈 비율");
  const ratio = async () => {
    const [a, b] = await Promise.all([columns.nth(0).boundingBox(), columns.nth(1).boundingBox()]);
    return a!.width / (a!.width + b!.width);
  };
  expect(Math.abs((await ratio()) - 0.5)).toBeLessThan(0.05);

  const bar = page.getByTestId("column-resize-handle");
  await columns.nth(0).hover();
  await expect(bar).toHaveCount(1);
  const grip = (await bar.boundingBox())!;
  const left = (await columns.nth(0).boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 + left.width * 0.3, grip.y + grip.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  await expect.poll(ratio).toBeGreaterThan(0.6);
  await expect(page.locator('input[type="hidden"][name="body"]')).toHaveValue(/::: column \d+\n/);

  await expect(page.getByText("저장됨", { exact: true })).toBeVisible({ timeout: 20_000 });
  await deleteCurrentItem(page);
  await expect(page).toHaveURL(/\/notes$/);
});
