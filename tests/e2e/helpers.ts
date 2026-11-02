import { expect, type Page } from "@playwright/test";

export type Section = "projects" | "papers" | "seminars" | "thoughts";

/** Unique, fake titles so repeated runs never collide. */
export const uniqueTitle = (prefix: string) => `${prefix} ${Date.now().toString(36)}`;

/** Fills the title on a /<section>/new form and saves; resolves on the detail page. */
export async function createItem(page: Page, section: Section, title: string) {
  await page.goto(`/${section}/new`);
  await page.getByLabel("제목").first().fill(title);
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(new RegExp(`/${section}/(?!new)[^/]+$`));
  await expect(page.getByLabel("제목").first()).toHaveValue(title);
}

/** Deletes the item shown on the current detail page via the confirm dialog. */
export async function deleteCurrentItem(page: Page) {
  await page.getByRole("button", { name: "삭제" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "삭제" }).click();
}
