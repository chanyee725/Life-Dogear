import { expect, type Locator, type Page } from "@playwright/test";

export type Section = "projects" | "papers" | "seminars" | "thoughts";

/** Unique, fake titles so repeated runs never collide. */
export const uniqueTitle = (prefix: string) => `${prefix} ${Date.now().toString(36)}`;

/** Fills the title on a /<section>/new form and saves; resolves on the detail page. */
export async function createItem(page: Page, section: Section, title: string) {
  await page.goto(`/${section}/new`);
  await page.getByLabel("제목", { exact: true }).fill(title);
  await page.getByRole("button", { name: "저장" }).click();
  // Generous: the first save of a run waits for the dev server to compile the detail page.
  await expect(page).toHaveURL(new RegExp(`/${section}/(?!new)[^/]+$`), { timeout: 20_000 });
  await expect(page.getByLabel("제목", { exact: true })).toHaveValue(title);
}

/** Deletes the item shown on the current detail page via the confirm dialog. */
export async function deleteCurrentItem(page: Page) {
  await page.getByRole("button", { name: "삭제", exact: true }).first().click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: "삭제" }).click();
}

/** Shown when the delay cookie had no effect: the web server lacks `E2E_HOOKS=1`. */
export const HOOKS_HINT =
  "달력 지연 쿠키가 먹지 않았다: 웹 서버가 E2E_HOOKS=1로 떴는지 확인 (playwright.config.ts의 webServer, 포트는 E2E_PORT로)";

/** Opens the home 빠른 추가 popover (할 일 추가 over 생각 추가) and returns it. */
export async function openQuickAdd(page: Page) {
  await page.getByRole("button", { name: "빠른 추가" }).click();
  const popover = page.getByRole("dialog", { name: "빠른 추가" });
  await expect(popover).toBeVisible();
  return popover;
}

/**
 * Picks `label` in a shadcn (Radix) Select. The trigger is a `combobox` button, not a
 * native `<select>`, so `selectOption` does not apply: open it from the keyboard, then click.
 */
export async function pickOption(page: Page, trigger: Locator, label: string) {
  await trigger.focus();
  await trigger.press("Enter");
  await page.getByRole("option", { name: label, exact: true }).click();
  await expect(trigger).toHaveText(label);
}
