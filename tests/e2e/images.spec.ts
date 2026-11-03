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
  await expect(page.locator(".rb-prose img")).toHaveAttribute("alt", "whiteboard");
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
