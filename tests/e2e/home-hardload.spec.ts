import { expect, test, type BrowserContext, type Page } from "@playwright/test";

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
  // Hydrated once the `/` shortcut moves focus (retry: key presses before hydration do nothing).
  const thought = page.getByRole("textbox", { name: /생각 추가/ });
  await expect(async () => {
    await page.keyboard.press("/");
    await expect(thought).toBeFocused({ timeout: 300 });
  }).toPass({ timeout: 4_000 });
  // Still loading: the calendar region is busy and says so.
  const loading = page.getByText("일정 불러오는 중…");
  await expect(loading).toBeVisible();
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
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
    await expect(taskInput).toHaveValue("");
  } finally {
    await context.clearCookies({ name: "e2e-calendar-delay" });
  }
});
