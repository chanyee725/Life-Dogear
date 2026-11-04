import { expect, test, type Page } from "@playwright/test";
import { deleteCurrentItem, uniqueTitle } from "./helpers";

const editor = (page: Page) => page.getByRole("textbox", { name: "본문" });
const menu = (page: Page) => page.getByRole("listbox", { name: "블록 넣기" });
const option = (page: Page, name: string) => menu(page).getByRole("option", { name });

/** Creates a note through /notes/new and waits for its detail page. */
async function createNote(page: Page, title: string) {
  await page.goto("/notes/new");
  await page.getByLabel("제목", { exact: true }).fill(title);
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/notes\/(?!new)[^/]+$/, { timeout: 20_000 });
}

test("'/' 메뉴: 블록 넣기, 키보드, 뜨지 않는 곳", async ({ page }) => {
  const host = uniqueTitle("슬래시 노트");
  await createNote(page, host);
  await editor(page).click();

  // '/' → 제목 2 (↑ from the top wraps to the bottom, ↓ wraps back).
  await page.keyboard.type("/");
  await expect(menu(page)).toBeVisible();
  await expect(option(page, "페이지")).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowUp");
  await expect(option(page, "사진")).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowDown");
  await expect(option(page, "페이지")).toHaveAttribute("aria-selected", "true");
  await option(page, "제목 2").click();
  await expect(menu(page)).toBeHidden();
  await page.keyboard.type("소제목");
  await expect(editor(page).locator("h2")).toHaveText("소제목");
  await page.keyboard.press("Enter");

  // '/할' → 할 일.
  await page.keyboard.type("/할");
  await expect(menu(page).getByRole("option")).toHaveText(["☐할 일"]);
  await page.keyboard.press("Enter");
  await page.keyboard.type("장보기");
  await expect(editor(page).locator('ul[data-type="taskList"] li p')).toHaveText("장보기");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter"); // leave the list

  // Esc closes and keeps the '/'.
  await page.keyboard.type("/");
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu(page)).toBeHidden();
  await expect(editor(page).locator("p", { hasText: /^\/$/ })).toHaveCount(1);
  await page.keyboard.press("Enter");

  // No match closes the menu; Enter is a normal line break again.
  await page.keyboard.type("/없는명령");
  await expect(menu(page)).toBeHidden();
  await page.keyboard.press("Enter");
  await expect(editor(page).locator("p", { hasText: "/없는명령" })).toHaveCount(1);

  // Mid-word '/' (paths, URLs) never opens.
  await page.keyboard.type("a/");
  await expect(menu(page)).toBeHidden();
  await page.keyboard.press("Enter");

  // The cursor leaving the '/' closes it.
  await page.keyboard.type("/코");
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press("Home");
  await expect(menu(page)).toBeHidden();
  // Back at the end it opens again; Esc leaves the text as typed.
  await page.keyboard.press("End");
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Enter");

  // Not inside [[ … ]] suggestions.
  await page.keyboard.type("[[제목 /");
  await expect(page.getByRole("listbox", { name: "연결할 항목" })).toBeVisible();
  await expect(menu(page)).toBeHidden();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Enter");

  // '/코드' → code block; '/' inside it stays text.
  await page.keyboard.type("/코드");
  await page.keyboard.press("Enter");
  await expect(editor(page).locator("pre")).toHaveCount(1);
  await expect(editor(page)).not.toContainText("/코드");
  await page.keyboard.type("/");
  await expect(menu(page)).toBeHidden();
  await expect(editor(page).locator("pre")).toContainText("/");

  await deleteCurrentItem(page);
  await expect(page).toHaveURL(/\/notes$/);
});

test("'/' → 페이지: 새 노트를 만들고 [[제목]]을 넣고 연결한다", async ({ page }) => {
  const host = uniqueTitle("슬래시 문서");
  const child = uniqueTitle("슬래시 새 페이지");
  await createNote(page, host);
  const hostUrl = page.url();

  await editor(page).click();
  await page.keyboard.type("/페이");
  await expect(menu(page).getByRole("option")).toHaveText(["📄페이지"]);
  await page.keyboard.press("Enter");
  const titleBox = page.getByRole("textbox", { name: "새 페이지 제목" });
  await expect(titleBox).toBeFocused();
  await titleBox.fill(child);
  await titleBox.press("Enter");

  await expect(titleBox).toBeHidden();
  await expect(editor(page).locator(`[data-wikilink="${child}"]`)).toBeVisible();
  // '/페이' is gone, only the link remains.
  await expect(editor(page)).not.toContainText("/페이");
  const connected = page.getByRole("region", { name: "연결된 항목" });
  const childLink = connected.getByRole("link", { name: child });
  await expect(childLink).toBeVisible({ timeout: 10_000 });

  // The new note links back to this document.
  await page.goto((await childLink.getAttribute("href"))!);
  await expect(page.getByLabel("제목", { exact: true })).toHaveValue(child);
  await expect(
    page.getByRole("region", { name: "연결된 항목" }).getByRole("link", { name: host }),
  ).toBeVisible();

  // Clean up both notes.
  await deleteCurrentItem(page);
  await expect(page).toHaveURL(/\/notes$/);
  await page.goto(hostUrl);
  await deleteCurrentItem(page);
  await expect(page).toHaveURL(/\/notes$/);
});

test("/notes/new: 저장 전에는 '페이지'가 없다", async ({ page }) => {
  await page.goto("/notes/new");
  await editor(page).click();
  await page.keyboard.type("/");
  await expect(menu(page)).toBeVisible();
  await expect(option(page, "제목 2")).toBeVisible();
  await expect(option(page, "페이지")).toHaveCount(0);
  await page.keyboard.type("페이지");
  await expect(menu(page)).toBeHidden();
});

test("한글 조합: 조합 중에는 메뉴가 유지되고, 끝나면 필터가 반영된다", async ({ page }) => {
  await page.goto("/notes/new");
  await editor(page).click();
  await page.keyboard.type("/");
  await expect(menu(page)).toBeVisible();

  // Compose 할 (ㅎ → 하 → 할) the way a Korean IME does.
  const cdp = await page.context().newCDPSession(page);
  for (const text of ["ㅎ", "하", "할"]) {
    await cdp.send("Input.imeSetComposition", {
      text,
      selectionStart: text.length,
      selectionEnd: text.length,
    });
    // Half-built syllables never close the menu.
    await expect(menu(page)).toBeVisible();
  }
  await expect(option(page, "제목 2")).toBeVisible();

  await cdp.send("Input.insertText", { text: "할" });
  await expect(menu(page).getByRole("option")).toHaveText(["☐할 일"]);
  await page.keyboard.press("Enter");
  await expect(editor(page).locator('ul[data-type="taskList"]')).toHaveCount(1);
  await expect(editor(page)).not.toContainText("/할");
});
