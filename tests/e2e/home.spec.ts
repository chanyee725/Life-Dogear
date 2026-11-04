import { expect, test } from "@playwright/test";
import { uniqueTitle } from "./helpers";

test("빠른 입력: Enter → 최근 생각에 표시", async ({ page }) => {
  const text = uniqueTitle("E2E quick");
  await page.goto("/");
  const input = page.getByRole("textbox", { name: /생각 추가/ });
  await input.fill(text);
  await input.press("Enter");
  await expect(page.getByText(text).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(text).first()).toBeVisible();
});

test("빠른 입력: 빈 값 Enter는 아무것도 만들지 않는다", async ({ page }) => {
  await page.goto("/");
  const before = await page.getByRole("link").count();
  const input = page.getByRole("textbox", { name: /생각 추가/ });
  await input.press("Enter");
  expect(await page.getByRole("link").count()).toBe(before);
});

test("할 일 추가: 달력에서 고른 날 마감으로 생기고 달력에 바로 보인다", async ({ page }) => {
  const title = uniqueTitle("E2E home task");
  const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    Date.now() + 86_400_000,
  );
  await page.goto("/");
  const calendar = page.getByRole("region", { name: "달력" });
  await calendar.locator(`[data-cal-cell="${tomorrow}"]`).first().click();
  const input = page.getByRole("textbox", { name: /^할 일 추가/ });
  await expect(input).toHaveAccessibleName(/마감/);
  // Empty Enter makes nothing; a title makes a task due on the selected day.
  await input.press("Enter");
  await expect(page.getByText("마감으로 추가했습니다.")).toHaveCount(0);
  await input.fill(title);
  await input.press("Enter");
  await expect(page.getByText("마감으로 추가했습니다.")).toBeVisible();
  await expect(input).toHaveValue("");
  await expect(calendar.locator(`[data-cal-cell="${tomorrow}"]`).getByText(title)).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: "달력" })
      .locator(`[data-cal-cell="${tomorrow}"]`)
      .getByText(title),
  ).toBeVisible();
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
});

test("수집함 개수 줄은 /inbox로 연결된다", async ({ page }) => {
  await page.goto("/");
  const link = page.getByRole("link", { name: /수집함에 정리할 항목 \d+개/ });
  await expect(link).toHaveAttribute("href", "/inbox");
});
