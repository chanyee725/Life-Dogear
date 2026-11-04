import { expect, test } from "@playwright/test";
import { HOOKS_HINT, openQuickAdd, uniqueTitle } from "./helpers";

test("빠른 입력: Enter → 최근 생각에 표시", async ({ page }) => {
  const text = uniqueTitle("E2E quick");
  await page.goto("/");
  const input = (await openQuickAdd(page)).getByRole("textbox", { name: /생각 추가/ });
  await input.fill(text);
  await input.press("Enter");
  await expect(page.getByText(text).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(text).first()).toBeVisible();
});

test("빠른 입력: 빈 값 Enter는 아무것도 만들지 않는다", async ({ page }) => {
  await page.goto("/");
  const before = await page.getByRole("link").count();
  const input = (await openQuickAdd(page)).getByRole("textbox", { name: /생각 추가/ });
  await input.press("Enter");
  expect(await page.getByRole("link").count()).toBe(before);
});

test("할 일 추가: 달력에서 고른 날 마감으로 생기고 달력에 바로 보인다", async ({ page }) => {
  const title = uniqueTitle("E2E home task");
  const seoul = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" });
  const today = seoul.format(Date.now());
  const tomorrow = seoul.format(Date.now() + 86_400_000);
  await page.goto("/");
  const calendar = page.getByRole("region", { name: "달력" });
  await calendar.locator(`[data-cal-cell="${tomorrow}"]`).first().click();
  const input = (await openQuickAdd(page)).getByRole("textbox", { name: /^할 일 추가/ });
  const [, m, d] = tomorrow.split("-").map(Number);
  await expect(input).toHaveAccessibleName(`할 일 추가 (Enter로 ${m}월 ${d}일 마감)`);
  // Empty Enter makes nothing; a title makes a task due on the selected day.
  await input.press("Enter");
  await expect(page.getByText("마감으로 추가했습니다.")).toHaveCount(0);
  await input.fill(title);
  await input.press("Enter");
  await expect(page.getByText("마감으로 추가했습니다.")).toBeVisible();
  await expect(input).toHaveValue("");
  await expect(calendar.locator(`[data-cal-cell="${tomorrow}"]`).getByText(title)).toBeVisible();
  await expect(page.getByText(`${m}월 ${d}일 마감으로 추가했습니다.`)).toBeVisible();
  // Picking another day (closes the popover) moves the due day of the next add, while the
  // saved line keeps the day it was saved for.
  await calendar.locator(`[data-cal-cell="${today}"]`).first().click();
  await expect(page.getByRole("dialog", { name: "빠른 추가" })).toHaveCount(0);
  await openQuickAdd(page);
  const [, tm, td] = today.split("-").map(Number);
  await expect(input).toHaveAccessibleName(`할 일 추가 (Enter로 ${tm}월 ${td}일 마감)`);
  await expect(page.getByText(`${m}월 ${d}일 마감으로 추가했습니다.`)).toBeVisible();
  await expect(page.getByText("오늘 마감으로 추가했습니다.")).toHaveCount(0);
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: "달력" })
      .locator(`[data-cal-cell="${tomorrow}"]`)
      .getByText(title),
  ).toBeVisible();

  // Clean up through the task list so later specs (tasks.spec "소속 없음 0") see no extra task.
  await page.goto("/tasks?tab=by-parent");
  await page.getByRole("button", { name: `할 일 메뉴: ${title}` }).click();
  await page.getByRole("menuitem", { name: "삭제" }).click();
  await expect(page.getByText(`‘${title}’을 지웠습니다.`).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: `할 일 메뉴: ${title}` })).toHaveCount(0);
});

test("할 일 추가: 300자를 넘으면 자르지 않고 안내하며 저장하지 않는다", async ({ page }) => {
  await page.goto("/");
  const input = (await openQuickAdd(page)).getByRole("textbox", { name: /^할 일 추가/ });
  const long = "가".repeat(301);
  await input.fill(long);
  await expect(page.getByText("300자까지 쓸 수 있습니다.")).toBeVisible();
  await input.press("Enter");
  await expect(input).toHaveValue(long);
  await expect(page.getByText("마감으로 추가했습니다.")).toHaveCount(0);
});

test("이어 읽기: 읽는 중 논문 2편과 진행률 표시", async ({ page }) => {
  await page.goto("/");
  const section = page.getByRole("region", { name: "이어 읽기" });
  await expect(section.getByText("Note-Taking Tools and Depth of Literature Review")).toBeVisible();
  await expect(section.getByText("Compact Language Models for Domain Summarization")).toBeVisible();
  // "다 읽음"·"읽을 예정" 논문은 나오지 않는다.
  await expect(
    section.getByText("Evaluating Abstractive Summaries Without References"),
  ).toHaveCount(0);
  const bars = section.getByRole("progressbar", { name: "읽기 진행률" });
  await expect(bars.first()).toHaveAttribute("aria-valuenow", /^\d+$/);
});

test("표/카드 보기 전환은 새로고침 뒤에도 유지된다", async ({ page }) => {
  await page.goto("/papers");
  await page.getByRole("radio", { name: "카드 보기" }).click();
  await expect(page.getByRole("radio", { name: "카드 보기" })).toBeChecked();
  await page.reload();
  await expect(page.getByRole("radio", { name: "카드 보기" })).toBeChecked();
  await page.getByRole("radio", { name: "표 보기" }).click();
  await expect(page.getByRole("radio", { name: "표 보기" })).toBeChecked();
});

test("다크 모드 토글", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  await page.getByRole("radio", { name: "다크" }).click();
  await expect(html).toHaveClass(/dark/);
  await page.reload();
  await expect(html).toHaveClass(/dark/);
  await page.getByRole("radio", { name: "라이트" }).click();
  await expect(html).not.toHaveClass(/dark/);
});

test("테마 토글: Tab으로 들어가 → 두 번이면 다크", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  const theme = page.getByRole("radiogroup", { name: "화면 테마" });
  const system = theme.getByRole("radio", { name: "시스템 설정" });
  await expect(system).toHaveAttribute("aria-checked", "true");
  // Start just before the group, then one Tab lands on the checked option.
  await system.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(system).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(theme.getByRole("radio", { name: "다크" })).toHaveAttribute("aria-checked", "true");
  await expect(theme.getByRole("radio", { name: "다크" })).toBeFocused();
  await expect(html).toHaveClass(/dark/);
  await theme.getByRole("radio", { name: "라이트" }).click();
});

test("홈: 진행 중인 연구(칸반)와 프로젝트가 따로 보인다", async ({ page }) => {
  await page.goto("/");
  const research = page.getByRole("region", { name: "진행 중인 연구" });
  // Seeded research projects show on the kanban, general ones only in 프로젝트.
  await expect(
    research.getByRole("link", { name: /소규모 언어모델 요약 품질 비교/ }),
  ).toBeVisible();
  await expect(research.getByText("연구실 세미나 발표 준비")).toHaveCount(0);

  const general = page.getByRole("region", { name: "프로젝트", exact: true });
  await expect(general.getByRole("link", { name: /연구실 세미나 발표 준비/ })).toBeVisible();
  await expect(general.getByRole("link", { name: "모두 보기" })).toHaveAttribute(
    "href",
    "/projects?kind=general",
  );
  // 다음 할 일 is no longer shown on home cards (seeded values stay in the DB).
  await expect(page.getByText("선행 연구 5편 요약 정리")).toHaveCount(0);
  await expect(page.getByText("발표 슬라이드 목차 정하기")).toHaveCount(0);
});

test("수집함 개수 줄은 /inbox로 연결된다", async ({ page }) => {
  await page.goto("/");
  const link = page.getByRole("link", { name: /수집함에 정리할 항목 \d+개/ });
  await expect(link).toHaveAttribute("href", "/inbox");
});

test("홈 달력 블록: 오른쪽 패널에 오늘 할 일 → 다음 일정, 입력칸은 없고 높이는 달력에 맞춘다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const calendar = page.getByRole("region", { name: "달력" });
  const heading = calendar.getByRole("heading", { name: /오늘 할 일/ });
  const upcoming = calendar.getByRole("heading", { name: /다음 일정/ });
  const grid = calendar.getByRole("grid");
  await expect(upcoming).toBeVisible();
  // The inputs live in 빠른 추가 only.
  await expect(page.getByRole("textbox", { name: /할 일 추가|생각 추가/ })).toHaveCount(0);
  const [h, u] = await Promise.all([heading, upcoming].map(async (l) => (await l.boundingBox())!));
  expect(h.y).toBeLessThan(u.y);
  // The separate 오늘 section is gone: one "오늘 할 일" heading on the page.
  await expect(page.getByRole("heading", { name: /오늘 할 일/ })).toHaveCount(1);
  // The panel ends with the grid column (no gap under the calendar).
  const panel = upcoming.locator("xpath=ancestor::section[1]");
  const p = (await panel.boundingBox())!;
  const left = (await grid.locator("xpath=..").boundingBox())!;
  expect(p.y + p.height).toBeLessThanOrEqual(left.y + left.height + 2);
  // 빠른 추가 sits top right of the block, above the grid.
  const quick = page.getByRole("button", { name: "빠른 추가" });
  const q = (await quick.boundingBox())!;
  const c = (await calendar.boundingBox())!;
  expect(q.y).toBeLessThan(left.y);
  expect(c.x + c.width - (q.x + q.width)).toBeLessThan(4);

  // Narrow: still reachable, top right, above the panel and the grid.
  await page.setViewportSize({ width: 390, height: 844 });
  const [q2, h2, g2] = await Promise.all(
    [quick, heading, grid].map(async (l) => (await l.boundingBox())!),
  );
  expect(q2.x + q2.width).toBeLessThanOrEqual(390);
  expect(q2.y).toBeLessThan(h2.y);
  expect(h2.y).toBeLessThan(g2.y);
});

test("빠른 추가: 열면 할 일 추가에 포커스, 생각 추가는 그 아래, Esc·바깥 클릭으로 닫힌다", async ({
  page,
}) => {
  await page.goto("/");
  const quick = page.getByRole("button", { name: "빠른 추가" });
  await expect(quick).toHaveAttribute("aria-expanded", "false");
  const popover = await openQuickAdd(page);
  await expect(quick).toHaveAttribute("aria-expanded", "true");
  const task = popover.getByRole("textbox", { name: /^할 일 추가/ });
  const thought = popover.getByRole("textbox", { name: /생각 추가/ });
  await expect(task).toBeFocused();
  const [t, th] = await Promise.all([task, thought].map(async (l) => (await l.boundingBox())!));
  expect(t.y).toBeLessThan(th.y);
  // Esc closes and puts focus back on the button.
  await page.keyboard.press("Escape");
  await expect(popover).toHaveCount(0);
  await expect(quick).toBeFocused();
  // An outside click closes it too; focus goes back to the button.
  await openQuickAdd(page);
  await page.getByRole("heading", { name: /다음 일정/ }).click();
  await expect(popover).toHaveCount(0);
  await expect(quick).toBeFocused();
  // Closed, it stays in the DOM but hidden: Tab from the button never lands in its inputs.
  const kept = page.locator('[role="dialog"][aria-label="빠른 추가"]');
  await expect(kept).toBeAttached();
  await expect(kept).toBeHidden();
  await expect(kept.locator("input")).toHaveCount(2);
  await page.keyboard.press("Tab");
  await expect(kept.locator("input:focus")).toHaveCount(0);
  // `/` opens it on 생각 추가, even though the hidden input is still in the DOM.
  await page.keyboard.press("/");
  await expect(thought).toBeFocused();
  await expect(quick).toHaveAttribute("aria-controls", (await popover.getAttribute("id"))!);
});

test("빠른 추가: 오른쪽 끝이 버튼 오른쪽에 맞고, 닫았다 열어도 입력값이 남는다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const quick = page.getByRole("button", { name: "빠른 추가" });
  const popover = await openQuickAdd(page);
  const [b, p] = await Promise.all([quick, popover].map(async (l) => (await l.boundingBox())!));
  expect(Math.abs(b.x + b.width - (p.x + p.width))).toBeLessThan(2);
  const task = popover.getByRole("textbox", { name: /^할 일 추가/ });
  const thought = popover.getByRole("textbox", { name: /생각 추가/ });
  await task.fill("닫아도 남는 할 일");
  await thought.fill("닫아도 남는 생각");
  await page.keyboard.press("Escape");
  await expect(popover).toHaveCount(0);
  await openQuickAdd(page);
  await expect(task).toHaveValue("닫아도 남는 할 일");
  await expect(thought).toHaveValue("닫아도 남는 생각");
});

test("홈 달력 블록: 오늘 마감 할 일은 '오늘 할 일'에만 한 번 보인다 (390px·1280px)", async ({
  page,
}) => {
  const title = uniqueTitle("E2E today once");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const calendar = page.getByRole("region", { name: "달력" });
  const input = (await openQuickAdd(page)).getByRole("textbox", { name: /^할 일 추가/ });
  await input.fill(title);
  await input.press("Enter");
  await expect(page.getByText("마감으로 추가했습니다.")).toBeVisible();
  // Not again under 다음 일정 › 오늘, nor in a day list under the grid.
  await expect(calendar.getByText(title, { exact: true })).toHaveCount(1);
  await page.screenshot({ path: "test-results/home-today-once-390.png", fullPage: true });
  // Wide: the month cell shows it too; outside the grid only once.
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(calendar.getByRole("grid").getByText(title, { exact: true })).toHaveCount(1);
  await expect(calendar.getByText(title, { exact: true })).toHaveCount(2);
  await page.screenshot({ path: "test-results/home-today-once-1280.png", fullPage: true });

  await page.goto("/tasks?tab=by-parent");
  await page.getByRole("button", { name: `할 일 메뉴: ${title}` }).click();
  await page.getByRole("menuitem", { name: "삭제" }).click();
  await expect(page.getByText(`‘${title}’을 지웠습니다.`).first()).toBeVisible();
});

test("`/`로 홈에 와서 달력이 늦게 와도 입력한 글자와 포커스가 남는다", async ({
  page,
  context,
  baseURL,
}) => {
  await page.goto("/tasks");
  await context.addCookies([{ name: "e2e-calendar-delay", value: "3000", url: baseURL! }]);
  await page.keyboard.press("/");
  const input = page.getByRole("textbox", { name: /생각 추가/ });
  await expect(input).toBeFocused();
  // Still loading: the grid is busy and the panel says so; the input works meanwhile.
  const calendar = page.getByRole("region", { name: "달력" });
  const grid = calendar.getByTestId("home-calendar-grid");
  await expect(grid, HOOKS_HINT).toHaveAttribute("aria-busy", "true");
  // Only the grid is busy, not the block with the inputs.
  await expect(calendar).not.toHaveAttribute("aria-busy");
  await expect(calendar.getByText("일정 불러오는 중…")).toBeVisible();
  await expect(calendar.getByTestId("next-count")).toHaveText("…");
  await page.keyboard.type("느린 달력");
  await expect(grid).not.toHaveAttribute("aria-busy", { timeout: 10_000 });
  await expect(calendar.getByText("일정 불러오는 중…")).toHaveCount(0);
  await expect(calendar.getByTestId("next-count")).toHaveText(/^\d+$/);
  await expect(input).toHaveValue("느린 달력");
  await expect(input).toBeFocused();
  await page.keyboard.type("!");
  await expect(input).toHaveValue("느린 달력!");
  await context.clearCookies({ name: "e2e-calendar-delay" });
});
