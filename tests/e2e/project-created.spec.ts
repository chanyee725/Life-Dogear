import { expect, test, type Page } from "@playwright/test";
import { createItem, deleteCurrentItem, uniqueTitle } from "./helpers";

/** Today in Seoul as `YYYY.MM.DD`. */
const seoulToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" })
    .format(new Date())
    .replace(/-/g, ".");

const createdValue = (page: Page) => page.locator("dt", { hasText: "생성일" }).locator("+ dd");

test("프로젝트 생성일: 상세에 읽기 전용으로 보이고, 수정 저장 후에도 그대로, 목록에도 보인다", async ({
  page,
}) => {
  // Cold dev server: create, detail and list pages compile on first visit.
  test.slow();
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

test("프로젝트: 다음 할 일은 목록·상세에 없고, 저장해도 기존 값은 남는다", async ({ page }) => {
  // Cold dev server: two project pages compile on first visit, plus two reloads.
  test.slow();
  await page.goto("/projects?kind=general");
  await expect(page.getByRole("columnheader", { name: "다음 할 일" })).toHaveCount(0);
  await expect(page.getByText("발표 슬라이드 목차 정하기")).toHaveCount(0);

  await page.goto("/projects/seed-project-4");
  await expect(page.getByText("다음 할 일")).toHaveCount(0);
  // Kept as a hidden field so saving sends the stored value back unchanged.
  const hidden = page.locator('input[type="hidden"][name="nextAction"]');
  await expect(hidden).toHaveValue("발표 슬라이드 목차 정하기");
  // Save a real edit, then put the seeded title back.
  const title = page.getByLabel("제목", { exact: true });
  const original = await title.inputValue();
  await title.fill(`${original} (e2e)`);
  await expect(page.getByText("저장됨", { exact: true })).toBeVisible();
  await page.reload();
  await expect(title).toHaveValue(`${original} (e2e)`);
  await expect(hidden).toHaveValue("발표 슬라이드 목차 정하기");
  await title.fill(original);
  // Wait for this save itself (not an earlier 저장됨), then check it stuck after a reload.
  await expect(page.getByText("저장 안 됨")).toBeVisible();
  await expect(page.getByText("저장됨", { exact: true })).toBeVisible();
  await page.reload();
  await expect(title).toHaveValue(original);
});
