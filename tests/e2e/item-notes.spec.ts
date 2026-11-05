import { expect, test } from "@playwright/test";
import { createItem, deleteCurrentItem, uniqueTitle } from "./helpers";

test("프로젝트 노트 섹션: 비었으면 ＋ 새 노트, 만든 노트가 연결되어 보인다", async ({ page }) => {
  // First visits compile several pages on the dev server.
  test.setTimeout(120_000);
  const projectTitle = uniqueTitle("노트 섹션 프로젝트");
  await createItem(page, "projects", projectTitle);
  const projectUrl = page.url();
  const projectId = projectUrl.split("/").pop()!;

  const section = page.getByRole("region", { name: "노트" });
  await expect(section.getByRole("listitem")).toHaveCount(0);
  await section.getByRole("link", { name: "＋ 새 노트" }).click();
  await expect(page).toHaveURL(new RegExp(`/notes/new\\?project=${projectId}$`));
  // The template picker is still there.
  await expect(page.getByRole("radiogroup", { name: "템플릿" })).toBeVisible();

  const noteTitle = uniqueTitle("프로젝트 노트");
  await page.getByLabel("제목", { exact: true }).fill(noteTitle);
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/notes\/(?!new)[^/]+$/, { timeout: 20_000 });
  const noteUrl = page.url();
  await expect(page.getByText("생성일")).toBeVisible();
  await expect(page.getByText(/^\d{4}\.\d{2}\.\d{2}$/)).toBeVisible();

  await page.goto(projectUrl);
  const row = section.getByRole("listitem");
  await expect(row).toHaveCount(1);
  await expect(row.getByRole("link", { name: noteTitle })).toHaveAttribute("href", /\/notes\//);
  // Last edit as a Seoul date, not "방금 전".
  await expect(row.locator("time")).toHaveText(/^\d{4}\.\d{2}\.\d{2}$/);
  await expect(section.getByRole("link", { name: "새 노트", exact: true })).toBeVisible();

  // The notes list has a 생성일 column.
  await page.goto("/notes");
  await expect(page.getByRole("columnheader", { name: "생성일" })).toBeVisible();

  // Clean up what this test made.
  await page.goto(noteUrl);
  await deleteCurrentItem(page);
  await expect(page).toHaveURL(/\/notes$/);
  await page.goto(projectUrl);
  await expect(section.getByRole("link", { name: "＋ 새 노트" })).toBeVisible();
  await deleteCurrentItem(page);
  await expect(page).toHaveURL(/\/projects$/);
});
