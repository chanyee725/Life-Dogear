import { expect, test, type Page } from "@playwright/test";
import { deleteCurrentItem, openQuickAdd, uniqueTitle } from "./helpers";

/**
 * Home and the calendar page never scroll sideways: not the page, and not a scroll box inside
 * it (the home "다음 일정" panel once scrolled 8px because of its rows' hover fill). Tasks and
 * project deadlines are not drawn on the calendar.
 */
const PAGES = ["/", "/tasks?view=calendar", "/tasks?view=calendar&range=month"];
const WIDTHS = [1280, 1440, 390];

async function sideways(page: Page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const boxes = [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((el) => {
        const { overflowX } = getComputedStyle(el);
        return (overflowX === "auto" || overflowX === "scroll") && el.scrollWidth > el.clientWidth;
      })
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`);
    return { page: de.scrollWidth - de.clientWidth, boxes };
  });
}

/** A seminar tomorrow with a long title, so "다음 일정" has rows; removed afterwards. */
async function withSeminar(page: Page, run: () => Promise<void>) {
  const seoul = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" });
  const tomorrow = seoul.format(Date.now() + 86_400_000);
  await page.goto("/seminars/new");
  await page.getByLabel("제목", { exact: true }).fill(uniqueTitle("E2E 긴 세미나 제목".repeat(8)));
  await page.getByLabel("날짜").fill(tomorrow);
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/seminars\/(?!new)[^/]+$/, { timeout: 20_000 });
  const detail = page.url();
  try {
    await run();
  } finally {
    await page.goto(detail);
    await deleteCurrentItem(page);
    await expect(page).toHaveURL(/\/seminars$/, { timeout: 20_000 });
  }
}

for (const path of PAGES) {
  test(`가로 스크롤 없음: ${path} (1280·1440·390)`, async ({ page }) => {
    await withSeminar(page, async () => {
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        const grid = page.getByRole("grid").first();
        await expect(grid).toBeVisible();
        await expect(grid).not.toHaveAttribute("aria-busy", "true");
        await expect(page.getByRole("heading", { name: /다음 일정/ })).toBeVisible();
        expect(await sideways(page), `${path} @ ${width}`).toEqual({ page: 0, boxes: [] });
      }
    });
  });
}

test("달력에 할 일·프로젝트 마감은 그리지 않는다 (홈·달력)", async ({ page }) => {
  // A task due tomorrow: neither the grid nor 다음 일정 shows it.
  const title = uniqueTitle("E2E 달력 밖 할 일");
  const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    Date.now() + 86_400_000,
  );
  await page.goto("/");
  const calendar = page.getByRole("region", { name: "달력" });
  await calendar.locator(`[data-cal-cell="${tomorrow}"]`).first().click();
  const input = (await openQuickAdd(page)).getByRole("textbox", { name: /^할 일 추가/ });
  await input.fill(title);
  await input.press("Enter");
  await expect(page.getByText("마감으로 추가했습니다.")).toBeVisible();
  try {
    for (const path of ["/", "/tasks?view=calendar&range=month"]) {
      await page.goto(path);
      const grid = page.getByRole("grid").first();
      await expect(grid).not.toHaveAttribute("aria-busy", "true");
      await expect(
        page.locator('[data-cal-item^="task:"], [data-cal-item^="project:"]'),
      ).toHaveCount(0);
      await expect(grid.getByText(title)).toHaveCount(0);
      const upcoming = page
        .getByRole("heading", { name: /다음 일정/ })
        .locator("xpath=ancestor::section[1]");
      await expect(upcoming).toBeVisible();
      await expect(upcoming.getByText(title)).toHaveCount(0);
    }
  } finally {
    await page.goto("/tasks?tab=by-parent");
    await page.getByRole("button", { name: `할 일 메뉴: ${title}` }).click();
    await page.getByRole("menuitem", { name: "삭제" }).click();
    await expect(page.getByText(`‘${title}’을 지웠습니다.`).first()).toBeVisible();
  }
  await page.goto("/tasks?view=calendar&range=month");
  // An old stored `project: true` is ignored and 표시 offers no 프로젝트.
  await page.evaluate(() =>
    localStorage.setItem("rb-calendar-sources", JSON.stringify({ project: true, task: true })),
  );
  await page.reload();
  await expect(page.getByRole("grid").first()).not.toHaveAttribute("aria-busy", "true");
  await expect(page.locator('[data-cal-item^="task:"], [data-cal-item^="project:"]')).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "표시" }).click();
  await expect(page.getByRole("checkbox", { name: "활동" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /프로젝트|할 일/ })).toHaveCount(0);
});
