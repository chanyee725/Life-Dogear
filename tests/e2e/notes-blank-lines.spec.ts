import { expect, test } from "@playwright/test";
import { uniqueTitle } from "./helpers";

test("노트: 엔터로 넣은 빈 줄이 저장·새로고침 뒤에도 남는다", async ({ page }) => {
  const title = uniqueTitle("빈 줄 노트");
  await page.goto("/notes/new");
  await page.getByLabel("제목", { exact: true }).fill(title);
  const editor = page.getByRole("textbox", { name: "본문" });
  await editor.click();
  await editor.evaluate((el) => {
    const data = new DataTransfer();
    data.setData("text/plain", "```bash\nls\n```\n\n## Workspace 셋업\n\n본문\n\n끝");
    el.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
    );
  });

  // Two blank lines between "본문" and "끝". Before typing, wait until ProseMirror's own
  // selection (not just the DOM caret) sits at the end of "본문": right after the paste it is
  // still at the end of the document, and Enter pressed before it syncs lands after "끝".
  await expect(async () => {
    await editor.getByText("본문", { exact: true }).click();
    await page.keyboard.press("End");
    const at = await editor.evaluate((el) => {
      const { $from, empty } = (
        el as HTMLElement & {
          editor: {
            state: {
              selection: {
                empty: boolean;
                $from: { parent: { textContent: string }; parentOffset: number };
              };
            };
          };
        }
      ).editor.state.selection;
      return empty ? `${$from.parent.textContent}@${$from.parentOffset}` : "range";
    });
    expect(at).toBe("본문@2");
  }).toPass({ timeout: 5_000 });
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");

  const shape = () =>
    editor.evaluate((el) =>
      [...el.children].map((c) => c.tagName + (c.textContent?.trim() ? "" : ":empty")),
    );
  const expected = ["DIV", "H2", "P", "P:empty", "P:empty", "P"];
  await expect.poll(shape).toEqual(expected);

  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/notes\/(?!new)[^/]+$/, { timeout: 20_000 });
  await page.reload();
  await expect(editor.getByRole("heading", { name: "Workspace 셋업" })).toBeVisible();
  await expect.poll(shape).toEqual(expected);
});
