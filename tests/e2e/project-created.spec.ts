import { expect, test, type Page } from "@playwright/test";
import { createItem, deleteCurrentItem, uniqueTitle } from "./helpers";

/** Today in Seoul as `YYYY.MM.DD`. */
const seoulToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date()).replace(/-/g, ".");

const createdValue = (page: Page) => page.locator("dt", { hasText: "생성일" }).locator("+ dd");

test("프로젝트 생성일: 상세에 읽기 전용으로 보이고, 수정 저장 후에도 그대로, 목록에도 보인다", async ({
  page,
}) => {
  const title = uniqueTitle("생성일 프로젝트");
  await createItem(page, "projects", title);
  const today = seoulToday();
  await expect(createdValue(page)).toHaveText(today);
  await expect(createdValue(page).locator("input")).toHaveCount(0);

  await page.getByLabel("제목", { exact: true }).fill(`${title} 수정`);
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("저장됨", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("제목", { exact: true })).toHaveValue(`${title} 수정`);
  await expect(createdValue(page)).toHaveText(today);

  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/projects?sort=created");
  await expect(page.getByRole("columnheader", { name: "생성일" })).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: `${title} 수정` });
  await expect(row).toContainText(today);

  await row.getByRole("link").first().click();
  await expect(page.getByLabel("제목", { exact: true })).toHaveValue(`${title} 수정`);
  await deleteCurrentItem(page);
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByText(`${title} 수정`)).toHaveCount(0);
});
