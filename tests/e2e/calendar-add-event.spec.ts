import { expect, test, type Page } from "@playwright/test";

// '일정 추가' on 할 일 → 달력 (docs/PLAN-CAL-WRITE.md, UI). Google is never called.
//
// The server decides `googleWrite`, so the two halves need two server runs:
//   npx playwright test tests/e2e/calendar-add-event.spec.ts
//     → no GOOGLE_OAUTH_* keys: button disabled with "Google 캘린더 연결이 필요해요"
//   E2E_GOOGLE_WRITE=1 npx playwright test tests/e2e/calendar-add-event.spec.ts
//     → dummy keys (playwright.config.ts): success and failure, POST answered by page.route
// The ICS copy of an added event is covered by tests/unit/calendar-add-event.test.ts.

const CALENDAR = "/tasks?view=calendar";
const ADDED = "Google 캘린더에 추가했습니다.";
const WRITE = process.env.E2E_GOOGLE_WRITE === "1";

/** Today in Asia/Seoul, as the app computes it (the form's default date). */
const seoulToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

/** A Google item as `POST /api/calendar/events` returns it (Seoul offset). */
function writtenItem(title: string) {
  const day = seoulToday();
  const start = `${day}T10:00:00+09:00`;
  return {
    id: `google:e2e-${Date.now().toString(36)}@google.com:${start}`,
    source: "google" as const,
    title,
    start,
    end: `${day}T11:00:00+09:00`,
    allDay: false,
    href: "https://calendar.google.com/calendar/event?eid=e2e",
  };
}

/** POST /api/calendar/events → `status` with `body`; returns the request bodies sent. */
async function mockPost(page: Page, status: number, body: unknown) {
  const sent: unknown[] = [];
  await page.route(/\/api\/calendar\/events$/, (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    sent.push(route.request().postDataJSON());
    return route.fulfill({ status, json: body });
  });
  return sent;
}

const addButton = (page: Page) => page.getByRole("button", { name: "일정 추가", exact: true });
const dialog = (page: Page) => page.getByRole("dialog", { name: "Google 캘린더에 일정 추가" });
const toast = (page: Page, text: string) => page.getByRole("status").filter({ hasText: text });
/** Grid entries named after `title` (Google: "Google 캘린더: 10시, <title>, …"). */
const entries = (page: Page, title: string) =>
  page
    .getByRole("grid")
    .first()
    .getByRole("link", { name: new RegExp(title) });

async function fillAndSubmit(page: Page, title: string, start?: string) {
  await addButton(page).click();
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByLabel("제목", { exact: true }).fill(title);
  if (start) await dialog(page).getByLabel("시작", { exact: true }).fill(start);
  await dialog(page).getByRole("button", { name: "추가", exact: true }).click();
}

test.describe("달력 일정 추가: 쓰기 설정 없음", () => {
  test.skip(WRITE, "E2E_GOOGLE_WRITE=1 서버에서는 쓰기가 켜져 있다");

  test("버튼이 비활성이고 'Google 캘린더 연결이 필요해요'가 보인다", async ({ page }) => {
    await page.goto(CALENDAR);
    await expect(addButton(page)).toBeDisabled();
    await expect(addButton(page)).toHaveAccessibleDescription("Google 캘린더 연결이 필요해요");
  });
});

test.describe("달력 일정 추가: 쓰기 설정 있음", () => {
  test.skip(!WRITE, "E2E_GOOGLE_WRITE=1로 띄운 서버가 필요하다");

  test("성공하면 토스트가 뜨고 달력에 바로 보인다", async ({ page }) => {
    const item = writtenItem("e2e 추가 성공");
    const sent = await mockPost(page, 201, { item });
    await page.goto(CALENDAR);
    await expect(addButton(page)).toBeEnabled();

    await fillAndSubmit(page, item.title, "10:00");
    await expect(toast(page, ADDED)).toBeVisible();
    await expect(dialog(page)).toBeHidden();
    await expect(entries(page, item.title)).toHaveCount(1);
    expect(sent).toHaveLength(1);
    // `clientId`: the retry key the form adds; its value is the form's business.
    expect(sent[0]).toMatchObject({ title: item.title, date: seoulToday(), start: "10:00" });
    expect(sent[0]).toHaveProperty("clientId", expect.any(String));
  });

  test("실패하면 안내 토스트가 뜨고 달력에는 없다", async ({ page }) => {
    const sent = await mockPost(page, 502, { error: "network" });
    await page.goto(CALENDAR);

    await fillAndSubmit(page, "e2e 추가 실패");
    await expect(toast(page, "Google에 연결하지 못했습니다")).toBeVisible();
    // The form stays open so the title can be sent again.
    await expect(dialog(page)).toBeVisible();
    await expect(entries(page, "e2e 추가 실패")).toHaveCount(0);
    expect(sent).toHaveLength(1);
  });
});
