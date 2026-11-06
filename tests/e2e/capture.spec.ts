import { expect, test, type Page } from "@playwright/test";
import { uniqueTitle } from "./helpers";

/** Presses `C` until the dialog opens (the shortcut listener attaches after hydration). */
async function openCapture(page: Page) {
  const dialog = page.getByRole("dialog", { name: "빠른 캡처" });
  await expect(async () => {
    if (!(await dialog.isVisible())) await page.locator("body").press("c");
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass();
  const input = dialog.getByRole("textbox", { name: "생각" });
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("");
  return { dialog, input };
}

test("빠른 캡처: C로 열고 ⌘/Ctrl+Enter로 수집함에 저장", async ({ page }) => {
  const text = uniqueTitle("E2E capture");
  await page.goto("/papers");
  const { dialog, input } = await openCapture(page);
  await input.fill(text);
  await input.press("ControlOrMeta+Enter");
  await expect(dialog).toBeHidden();
  const toast = page.getByRole("status").filter({ hasText: "수집함에 저장했습니다." });
  await expect(toast).toBeVisible();
  await toast.getByRole("link", { name: "보기" }).click();
  // /inbox may compile on first visit; same allowance as createItem.
  await expect(page).toHaveURL(/\/inbox$/, { timeout: 20_000 });
  await expect(page.getByText(text).first()).toBeVisible();
});

test("빠른 캡처: 링크만 붙여넣으면 링크로 바뀌고 Esc 두 번에 닫힌다", async ({ page }) => {
  await page.goto("/");
  const { dialog, input } = await openCapture(page);
  await input.evaluate((el) => {
    const data = new DataTransfer();
    data.setData("text/plain", "https://example.com/post");
    el.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
    );
  });
  await expect(dialog.getByRole("radio", { name: "링크" })).toHaveAttribute("aria-checked", "true");
  await expect(dialog.getByRole("textbox", { name: "링크" })).toHaveValue(
    "https://example.com/post",
  );
  await expect(dialog.getByText("링크로 바꿨습니다.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog.getByText("Esc를 한 번 더 누르면 지웁니다.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("빠른 캡처: Cmd/Ctrl+K 팔레트의 '빠른 캡처' 명령으로도 열린다", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("ControlOrMeta+k");
  const search = page.getByRole("combobox", { name: "검색어" });
  const box = await page.getByRole("dialog", { name: /검색/ }).boundingBox();
  const vp = page.viewportSize();
  if (box && vp) {
    expect(Math.abs(box.x + box.width / 2 - vp.width / 2)).toBeLessThan(2);
    expect(Math.abs(box.y + box.height / 2 - vp.height / 2)).toBeLessThan(2);
  }
  await search.fill("캡처");
  await expect(page.getByRole("option", { name: /빠른 캡처/ })).toBeVisible();
  await search.press("Enter");
  const dialog = page.getByRole("dialog", { name: "빠른 캡처" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "생각" })).toBeFocused();
});

test("빠른 캡처: ⇧⌘/Ctrl+Enter는 저장 후 창을 비우고 바로 이어 쓸 수 있다", async ({ page }) => {
  const first = uniqueTitle("E2E capture first");
  const second = uniqueTitle("E2E capture second");
  await page.goto("/");
  const { dialog, input } = await openCapture(page);
  await input.fill(first);
  await input.press("ControlOrMeta+Shift+Enter");
  await expect(dialog.getByText("저장했습니다.", { exact: true })).toBeVisible();
  await expect(input).toHaveValue("");
  await expect(input).toBeEditable();
  await input.pressSequentially(second);
  await input.press("ControlOrMeta+Enter");
  await expect(dialog).toBeHidden();
  await page.goto("/inbox");
  await expect(page.getByText(first).first()).toBeVisible();
  await expect(page.getByText(second).first()).toBeVisible();
});
