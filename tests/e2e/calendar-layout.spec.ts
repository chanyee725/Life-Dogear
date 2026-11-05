import { expect, test, type Page } from "@playwright/test";
import { deleteCurrentItem, uniqueTitle } from "./helpers";

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
  for (const path of ["/", "/tasks?view=calendar&range=month"]) {
    await page.goto(path);
    const grid = page.getByRole("grid").first();
    await expect(grid).not.toHaveAttribute("aria-busy", "true");
    await expect(page.locator('[data-cal-item^="task:"], [data-cal-item^="project:"]')).toHaveCount(
      0,
    );
  }
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
  await expect(page.getByRole("checkbox", { name: "세미나" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /프로젝트|할 일/ })).toHaveCount(0);
});
