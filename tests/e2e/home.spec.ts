import { expect, test } from "@playwright/test";
import { uniqueTitle } from "./helpers";

test("빠른 입력: Enter → 최근 생각에 표시", async ({ page }) => {
  const text = uniqueTitle("E2E quick");
  await page.goto("/");
  const input = page.getByRole("textbox", { name: /빠른 입력|생각/ }).first();
  await input.fill(text);
  await input.press("Enter");
  await expect(page.getByText(text).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(text).first()).toBeVisible();
});

test("빠른 입력: 빈 값 Enter는 아무것도 만들지 않는다", async ({ page }) => {
  await page.goto("/");
  const before = await page.getByRole("link").count();
  const input = page.getByRole("textbox", { name: /빠른 입력|생각/ }).first();
  await input.press("Enter");
  expect(await page.getByRole("link").count()).toBe(before);
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
  await expect(research.getByRole("link", { name: /소규모 언어모델 요약 품질 비교/ })).toBeVisible();
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
