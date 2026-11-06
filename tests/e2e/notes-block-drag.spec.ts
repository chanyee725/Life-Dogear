import { expect, test } from "@playwright/test";

test("노트: 블록 핸들을 끌어 문단 순서를 바꾼다", async ({ page }) => {
  await page.goto("/notes/new");
  const editor = page.getByRole("textbox", { name: "본문" });
  await editor.click();
  await editor.evaluate((el) => {
    const data = new DataTransfer();
    data.setData("text/plain", "첫째 문단\n\n둘째 문단\n\n셋째 문단");
    el.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
    );
  });
  const order = () =>
    editor.evaluate((el) => [...el.children].map((c) => c.textContent?.trim()).filter(Boolean));
  await expect.poll(order).toEqual(["첫째 문단", "둘째 문단", "셋째 문단"]);

  // Hover the first paragraph, then drag its grip below the third one.
  await editor.getByText("첫째 문단", { exact: true }).hover();
  const handle = page.getByRole("button", { name: "블록 이동" });
  await expect(handle).toBeVisible();
  const grip = (await handle.boundingBox())!;
  const third = (await editor.getByText("셋째 문단", { exact: true }).boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(third.x + 10, third.y + third.height / 2, { steps: 4 });
  await page.mouse.move(third.x + 10, third.y + third.height - 2, { steps: 2 });
  await expect(page.locator(".rb-drop-line")).toBeVisible();
  await page.mouse.up();

  await expect.poll(order).toEqual(["둘째 문단", "셋째 문단", "첫째 문단"]);
  await expect(page.locator('input[type="hidden"][name="body"]')).toHaveValue(
    "둘째 문단\n\n셋째 문단\n\n첫째 문단",
  );
});

test("노트: 문단을 2열의 오른쪽 열로 끌어 놓으면 새로고침 뒤에도 유지된다", async ({ page }) => {
  await page.goto("/notes/new");
  await page.getByLabel("제목", { exact: true }).fill(`열 끌기 ${Date.now()}`);
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/notes\/(?!new)[^/]+$/, { timeout: 20_000 });

  const editor = page.getByRole("textbox", { name: "본문" });
  await editor.click();
  await page.keyboard.type("/2");
  await page.keyboard.press("Enter");
  const columns = editor.locator('[data-type="columns"] > [data-type="column"]');
  await expect(columns).toHaveCount(2);
  await page.keyboard.type("왼쪽 글");
  await columns.nth(1).click();
  await page.keyboard.type("오른쪽 글");

  // A paragraph below the columns block.
  await editor.click({ position: { x: 20, y: (await editor.boundingBox())!.height - 10 } });
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("끌 문단");
  await expect(editor.getByText("끌 문단", { exact: true })).toBeVisible();

  await editor.getByText("끌 문단", { exact: true }).hover();
  const handle = page.getByRole("button", { name: "블록 이동" });
  await expect(handle).toBeVisible();
  const grip = (await handle.boundingBox())!;
  const target = (await columns.nth(1).getByText("오른쪽 글", { exact: true }).boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + 10, target.y + target.height / 2, { steps: 6 });
  await page.mouse.move(target.x + 10, target.y + target.height - 2, { steps: 3 });
  await expect(page.locator(".rb-drop-line")).toBeVisible();
  await page.mouse.up();

  await expect(columns.nth(1).getByText("끌 문단", { exact: true })).toBeVisible();
  await expect(columns.nth(0)).not.toContainText("끌 문단");
  await expect(page.locator('input[type="hidden"][name="body"]')).toHaveValue(
    /::: column\n오른쪽 글\n\n끌 문단\n:::/,
  );
  await expect(page.getByText("저장됨", { exact: true })).toBeVisible({ timeout: 20_000 });

  await page.reload();
  await expect(columns.nth(1).getByText("끌 문단", { exact: true })).toBeVisible();
  await expect(columns.nth(0)).not.toContainText("끌 문단");
});
