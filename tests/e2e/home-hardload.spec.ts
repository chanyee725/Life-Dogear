import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { HOOKS_HINT } from "./helpers";

// Hard load of `/` while the home calendar is still loading (e2e-calendar-delay cookie, needs E2E_HOOKS).
async function hardLoadSlow(page: Page, context: BrowserContext, baseURL: string) {
  // Warm the dev compile first so the delayed hard load hydrates well inside the delay.
  await page.goto("/");
  await expect(page.getByRole("region", { name: "달력" }).getByRole("grid")).toBeVisible({
    timeout: 60_000,
  });
  await context.addCookies([{ name: "e2e-calendar-delay", value: "5000", url: baseURL }]);
  // "commit": the streamed response only finishes (and `load` fires) after the delay.
  await page.goto("/", { waitUntil: "commit" });
  // Hydrated once `/` opens 빠른 추가 on 생각 추가 (retry: presses before hydration do nothing).
  const thought = page.getByRole("textbox", { name: /생각 추가/ });
  await expect(async () => {
    await page.keyboard.press("/");
    await expect(thought).toBeFocused({ timeout: 300 });
  }).toPass({ timeout: 4_000 });
  // Still loading: the calendar region is busy and says so.
  const loading = page.getByText("일정 불러오는 중…");
  await expect(loading, HOOKS_HINT).toBeVisible();
  return { thought, loading };
}

test("하드 로드 중 `/`로 연 입력의 값과 포커스가 달력 로딩 후에도 유지된다", async ({
  page,
  context,
  baseURL,
}) => {
  try {
    const { thought, loading } = await hardLoadSlow(page, context, baseURL!);
    await page.keyboard.type("하드로드");
    await expect(thought).toHaveValue("하드로드");
    await expect(loading).toBeHidden({ timeout: 10_000 });
    await expect(thought).toHaveValue("하드로드");
    await expect(thought).toBeFocused();
  } finally {
    await context.clearCookies({ name: "e2e-calendar-delay" });
  }
});

test("하드 로드 중 '할 일 추가'에 입력하고 Enter 하면 로딩 후 할 일이 저장된다", async ({
  page,
  context,
  baseURL,
}) => {
  const title = `하드로드 할 일 ${Date.now()}`;
  try {
    const { loading } = await hardLoadSlow(page, context, baseURL!);
    const taskInput = page.getByRole("textbox", { name: /할 일 추가/ });
    await taskInput.click();
    await page.keyboard.type(title);
    await expect(taskInput).toHaveValue(title);
    await page.keyboard.press("Enter");
    await expect(loading).toBeHidden({ timeout: 10_000 });
    await expect(taskInput).toHaveValue("");
    // Saved: it shows in the Todo popover (오늘 할 일); delete it there.
    await page.keyboard.press("Escape");
    const todo = page.getByRole("dialog", { name: "할 일" });
    await expect(async () => {
      const button = page.getByRole("button", { name: /^할 일 \d+개$/ });
      if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
      await expect(todo.getByText(title, { exact: true })).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
    await todo.getByRole("button", { name: `할 일 메뉴: ${title}` }).click();
    await page.getByRole("menuitem", { name: "삭제" }).click();
    await expect(page.getByText(`‘${title}’을 지웠습니다.`).first()).toBeVisible();
  } finally {
    await context.clearCookies({ name: "e2e-calendar-delay" });
  }
  // Deleted for good, so later specs (tasks.spec "소속 없음 0") see no extra task.
  await page.goto("/tasks?tab=by-parent");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
});

// Selector contract with the home calendar (#69).
const GRID = (page: Page) => page.getByTestId("home-calendar-grid");
const NEXT_COUNT = (page: Page) => page.getByTestId("next-count");

test("로딩 중 빠른 추가 입력칸('할 일 추가', '생각 추가')은 aria-busy 영역 밖에 있다", async ({
  page,
  context,
  baseURL,
}) => {
  try {
    const { loading } = await hardLoadSlow(page, context, baseURL!);
    for (const name of [/할 일 추가/, /생각 추가/]) {
      const input = page.getByRole("textbox", { name });
      const busyAncestors = input.locator('xpath=ancestor-or-self::*[@aria-busy="true"]');
      // One-shot count (no retry): a retrying assertion would pass once loading ends.
      expect(await busyAncestors.count()).toBe(0);
    }
    // Still loading when checked, so the zero above was measured during the load.
    await expect(loading).toBeVisible();
  } finally {
    await context.clearCookies({ name: "e2e-calendar-delay" });
  }
});

test("로딩 중 달력 그리드에 aria-busy=true, 로딩 후 사라진다", async ({
  page,
  context,
  baseURL,
}) => {
  try {
    const { loading } = await hardLoadSlow(page, context, baseURL!);
    await expect(GRID(page)).toHaveAttribute("aria-busy", "true");
    await expect(loading).toBeHidden({ timeout: 10_000 });
    await expect(GRID(page)).not.toHaveAttribute("aria-busy");
  } finally {
    await context.clearCookies({ name: "e2e-calendar-delay" });
  }
});

test("로딩 중 '다음 일정' 숫자가 0으로 잘못 보이지 않는다", async ({ page, context, baseURL }) => {
  try {
    const { loading } = await hardLoadSlow(page, context, baseURL!);
    // While loading the count is the placeholder "…", never a real "0".
    await expect(NEXT_COUNT(page)).toHaveText("\u2026");
    await expect(loading).toBeHidden({ timeout: 10_000 });
    await expect(NEXT_COUNT(page)).toHaveText(/^\d+$/);
  } finally {
    await context.clearCookies({ name: "e2e-calendar-delay" });
  }
});
