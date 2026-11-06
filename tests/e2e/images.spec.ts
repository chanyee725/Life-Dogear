import { expect, test } from "@playwright/test";
import { createItem, deleteCurrentItem, uniqueTitle } from "./helpers";

// 1×1 PNG (fake data, no real photo).
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test("사진: 툴바로 넣으면 저장되고 새로고침 뒤에도 보인다", async ({ page }) => {
  await createItem(page, "thoughts", uniqueTitle("E2E photo"));

  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /사진 넣기/ }).click();
  await (await chooser).setFiles({ name: "whiteboard.png", mimeType: "image/png", buffer: PNG });

  const img = page.locator(".rb-prose img");
  await expect(img).toHaveAttribute("src", /^\/api\/images\/[0-9a-f-]{36}\.png$/);
  await expect(page.getByText("저장됨", { exact: true })).toBeVisible();

  await page.reload();
  // New photos start without a caption (the alt text is the caption).
  await expect(page.locator(".rb-prose img")).toHaveAttribute("alt", "");
  const src = await page.locator(".rb-prose img").getAttribute("src");
  const response = await page.request.get(src!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");

  await deleteCurrentItem(page);
});

test("사진: 사진이 아닌 파일은 이유와 함께 거절된다", async ({ page }) => {
  await createItem(page, "thoughts", uniqueTitle("E2E photo reject"));
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /사진 넣기/ }).click();
  // Claims to be an image, but the bytes are SVG text: the server checks the bytes.
  await (
    await chooser
  ).setFiles({
    name: "fake.png",
    mimeType: "image/png",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "사진만 올릴 수 있습니다" }),
  ).toBeVisible();
  await expect(page.locator(".rb-prose img")).toHaveCount(0);
  await deleteCurrentItem(page);
});

test("사진: 복사 버튼, 캡션 입력, 가운데 정렬, 블록 이동", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await createItem(page, "thoughts", uniqueTitle("E2E photo caption"));
  const editor = page.getByRole("textbox", { name: "본문" });
  await editor.click();
  await page.keyboard.type("앞 문단");
  await page.keyboard.press("Enter");

  // A 240×120 photo drawn in the page (fake pixels), big enough to hover and measure.
  const wide = Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 240;
      canvas.height = 120;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(0, 0, 240, 120);
      return canvas.toDataURL("image/png").split(",")[1];
    }),
    "base64",
  );
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /사진 넣기/ }).click();
  await (await chooser).setFiles({ name: "image.png", mimeType: "image/png", buffer: wide });
  const img = editor.locator("figure.rb-image img");
  await expect(img).toHaveAttribute("src", /^\/api\/images\//);
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(240);

  // Copy: shown on hover, puts the photo itself on the clipboard.
  const copy = page.getByRole("button", { name: "사진 복사" });
  await img.hover();
  await expect(copy).toBeVisible();
  await expect.poll(() => copy.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  await copy.click();
  await expect(copy).toContainText("복사됨");
  const types = await page.evaluate(async () => (await navigator.clipboard.read())[0]?.types);
  expect(types).toContain("image/png");

  // Caption: typed under the photo, saved as the alt text.
  const caption = page.getByPlaceholder("캡션 추가");
  await expect(caption).toHaveValue("");
  await caption.fill("파란 사각형");
  await expect(page.locator('input[type="hidden"][name="body"]')).toHaveValue(
    /!\[파란 사각형\]\(\/api\/images\//,
  );

  // Photo and caption are centred in the editor column.
  const centre = async (selector: string) => {
    const box = (await editor.locator(selector).boundingBox())!;
    return box.x + box.width / 2;
  };
  const column = (await editor.boundingBox())!;
  const middle = column.x + column.width / 2;
  expect(Math.abs((await centre("figure.rb-image img")) - middle)).toBeLessThan(2);
  expect(await caption.evaluate((el) => getComputedStyle(el).textAlign)).toBe("center");

  // The block handle still moves the photo above the paragraph.
  await img.hover();
  const handle = page.getByRole("button", { name: "블록 이동" });
  await expect(handle).toBeVisible();
  const grip = (await handle.boundingBox())!;
  const first = (await editor.getByText("앞 문단", { exact: true }).boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(first.x + 10, first.y + first.height / 2, { steps: 4 });
  await page.mouse.move(first.x + 10, first.y + 2, { steps: 2 });
  await expect(page.locator(".rb-drop-line")).toBeVisible();
  await page.mouse.up();
  await expect(page.locator('input[type="hidden"][name="body"]')).toHaveValue(
    /^!\[파란 사각형\]\(\/api\/images\/[^)]+\)\n\n앞 문단/,
  );
  await expect(page.getByText("저장됨", { exact: true })).toBeVisible();

  // After a reload the caption is still there.
  await page.reload();
  await expect(page.getByPlaceholder("캡션 추가")).toHaveValue("파란 사각형");

  await deleteCurrentItem(page);
});

test("사진: 크기 버튼으로 본문 폭의 비율을 바꾸고 새로고침 뒤에도 유지된다", async ({ page }) => {
  await createItem(page, "thoughts", uniqueTitle("E2E photo size"));
  const editor = page.getByRole("textbox", { name: "본문" });
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /사진 넣기/ }).click();
  await (await chooser).setFiles({ name: "image.png", mimeType: "image/png", buffer: PNG });
  const img = editor.locator("figure.rb-image img");
  await expect(img).toHaveAttribute("src", /^\/api\/images\//);

  await img.hover();
  const sizes = page.getByRole("group", { name: "사진 크기" });
  await expect(sizes).toBeVisible();
  await expect(sizes.getByRole("button", { name: "원본" })).toHaveAttribute("aria-pressed", "true");
  await sizes.getByRole("button", { name: "중간" }).click();
  await expect(sizes.getByRole("button", { name: "중간" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('input[type="hidden"][name="body"]')).toHaveValue(
    /!\[\]\(\/api\/images\/[^)\s]+ "w=50"\)/,
  );

  // Half the column, still centred, caption the same width.
  const column = (await editor.boundingBox())!;
  const box = (await img.boundingBox())!;
  expect(Math.abs(box.width - column.width / 2)).toBeLessThan(3);
  expect(Math.abs(box.x + box.width / 2 - (column.x + column.width / 2))).toBeLessThan(3);
  const caption = (await page.getByPlaceholder("캡션 추가").boundingBox())!;
  expect(Math.abs(caption.width - box.width)).toBeLessThan(3);
  await expect(page.getByText("저장됨", { exact: true })).toBeVisible();

  await page.reload();
  await expect(editor.locator("figure.rb-image")).toHaveAttribute("data-width", "50");
  await deleteCurrentItem(page);
});

test("사진: 오른쪽 아래 모서리 핸들을 끌면 크기가 바뀌고 새로고침 뒤에도 유지된다", async ({
  page,
}) => {
  await createItem(page, "thoughts", uniqueTitle("E2E photo corner"));
  const editor = page.getByRole("textbox", { name: "본문" });
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /사진 넣기/ }).click();
  await (await chooser).setFiles({ name: "image.png", mimeType: "image/png", buffer: PNG });
  const img = editor.locator("figure.rb-image img");
  await expect(img).toHaveAttribute("src", /^\/api\/images\//);

  // Start from a known size: half the column.
  await img.hover();
  await page
    .getByRole("group", { name: "사진 크기" })
    .getByRole("button", { name: "중간" })
    .click();
  const column = (await editor.boundingBox())!;
  await expect
    .poll(async () => (await img.boundingBox())!.width)
    .toBeGreaterThan(column.width * 0.45);

  await img.hover();
  const handle = page.getByTestId("image-resize-handle");
  await expect(handle).toBeVisible();
  const grip = (await handle.boundingBox())!;
  const before = (await img.boundingBox())!;
  // Shrink: drag the bottom-right corner left by a quarter of the column.
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 - column.width * 0.25, grip.y + grip.height / 2, {
    steps: 8,
  });
  await page.mouse.up();

  await expect.poll(async () => (await img.boundingBox())!.width).toBeLessThan(before.width * 0.7);
  const after = (await img.boundingBox())!;
  const percent = Math.round((after.width / column.width) * 100);
  await expect(page.locator('input[type="hidden"][name="body"]')).toHaveValue(
    /!\[\]\(\/api\/images\/[^)\s]+ "w=\d{1,3}"\)/,
  );
  await expect(page.getByText("저장됨", { exact: true })).toBeVisible();

  await page.reload();
  const figure = page.locator("figure.rb-image");
  const saved = Number(await figure.getAttribute("data-width"));
  expect(Math.abs(saved - percent)).toBeLessThanOrEqual(3);
  expect(saved).not.toBe(50);
  await deleteCurrentItem(page);
});
