import { expect, test } from "@playwright/test";
import { createItem, deleteCurrentItem, uniqueTitle } from "./helpers";

test("노트 프로젝트 칸: 고르면 프로젝트 노트 섹션에 보이고, 해제하면 빠진다", async ({ page }) => {
  // First visits compile several pages on the dev server.
  test.setTimeout(120_000);
  const projectTitle = uniqueTitle("가짜 프로젝트");
  await createItem(page, "projects", projectTitle);
  const projectUrl = page.url();

  const noteTitle = uniqueTitle("가짜 노트");
  await page.goto("/notes/new");
  await page.getByLabel("제목", { exact: true }).fill(noteTitle);
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/notes\/(?!new)[^/]+$/, { timeout: 20_000 });
  const noteUrl = page.url();

  const picker = page.getByRole("combobox", { name: "프로젝트 추가" });
  await picker.focus();
  await picker.press("Enter");
  await page.getByRole("option", { name: projectTitle, exact: true }).click();
  const chips = page.getByRole("list", { name: "연결된 프로젝트" });
  await expect(chips.getByRole("link", { name: projectTitle })).toBeVisible();

  const section = page.getByRole("region", { name: "노트" });
  await expect(async () => {
    await page.goto(projectUrl);
    await expect(section.getByRole("link", { name: noteTitle })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });

  // The link survives a reload of the note, then is removed from the chip.
  await page.goto(noteUrl);
  await chips.getByRole("button", { name: `${projectTitle} 연결 해제` }).click();
  await expect(chips).toHaveCount(0);
  await page.goto(projectUrl);
  await expect(section.getByRole("link", { name: noteTitle })).toHaveCount(0);

  // Clean up what this test made.
  await deleteCurrentItem(page);
  await expect(page).toHaveURL(/\/projects$/);
  await page.goto(noteUrl);
  await deleteCurrentItem(page);
  await expect(page).toHaveURL(/\/notes$/);
});
