import { expect, test, type Page } from "@playwright/test";
import { uniqueTitle } from "./helpers";

const editor = (page: Page) => page.getByRole("textbox", { name: "본문" });

/** Pastes Markdown as plain text; the editor parses it (transformPastedText). */
async function pasteMarkdown(page: Page, markdown: string) {
  await editor(page).click();
  await editor(page).evaluate((el, text) => {
    const data = new DataTransfer();
    data.setData("text/plain", text);
    el.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
    );
  }, markdown);
}

const FENCES = [
  "```ts\nconst answer: number = 42;\n```",
  '```launch\n<launch>\n  <node pkg="demo" type="talker"/>\n</launch>\n```',
  "```\nno language here\n```",
  "```mermaid\ngraph TD\n  A --> B\n```",
];

test("코드 블록: 색칠·언어 표시·복사, 저장 후 Markdown 그대로", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const title = uniqueTitle("코드 노트");
  await page.goto("/notes/new");
  await page.getByLabel("제목", { exact: true }).fill(title);
  await pasteMarkdown(page, FENCES.join("\n\n"));
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/notes\/(?!new)[^/]+$/, { timeout: 20_000 });

  // Reload: the detail page shows the stored Markdown through the editor.
  await page.reload();
  const blocks = page.locator(".rb-code");
  await expect(blocks).toHaveCount(4);
  await expect(blocks.nth(0).locator(".hljs-keyword").first()).toHaveText("const");
  await expect(blocks.nth(1).locator(".hljs-name").first()).toHaveText("launch");
  // No language or an unknown one: plain text, never guessed.
  await expect(blocks.nth(2).locator("[class*='hljs-']")).toHaveCount(0);
  await expect(blocks.nth(3).locator("[class*='hljs-']")).toHaveCount(0);
  await expect(blocks.locator(".rb-code-lang:visible")).toHaveText(["ts", "launch", "mermaid"]);

  // Copy button.
  await blocks.nth(0).hover();
  const copy = blocks.nth(0).getByRole("button", { name: "코드 복사" });
  await copy.click();
  await expect(copy).toHaveText("복사됨");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "const answer: number = 42;",
  );

  // Round trip: the body field carries the same fences.
  const body = await page.locator('input[name="body"]').inputValue();
  expect(body).toBe(FENCES.join("\n\n"));
});

test("새 노트 템플릿: 고르면 본문이 채워지고, 직접 쓴 본문은 바뀌지 않는다", async ({ page }) => {
  await page.goto("/notes/new");
  const group = page.getByRole("radiogroup", { name: "템플릿" });
  await expect(group.getByRole("radio")).toHaveCount(5);
  await expect(group.getByRole("radio", { name: /빈 노트/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );

  await group.getByRole("radio", { name: /작업 로그/ }).click();
  await expect(editor(page).locator("h2").first()).toHaveText(/^\d{4}-\d{2}-\d{2}$/);

  // Untouched template body: switching replaces it. Arrow keys move the choice.
  await group.getByRole("radio", { name: /작업 로그/ }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(group.getByRole("radio", { name: /에러 해결/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(editor(page).locator("h2")).toHaveText(["증상", "원인", "해결", "참고"]);

  // The user writes something: a later choice keeps their body.
  await editor(page).locator("h2").first().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" 빌드 멈춤");
  await group.getByRole("radio", { name: /개념 정리/ }).click();
  await expect(group.getByRole("radio", { name: /개념 정리/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(editor(page).locator("h2").first()).toHaveText("증상 빌드 멈춤");
});
