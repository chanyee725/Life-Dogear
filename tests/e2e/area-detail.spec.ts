import { expect, test } from "@playwright/test";
import { deleteCurrentItem, pickOption, uniqueTitle } from "./helpers";

const AREA = "연구 분야";

test("영역 상세: 상태별 프로젝트 칸반 4열(빈 열 포함), 넓은 화면에서 목표·노트 나란히", async ({
  page,
}) => {
  test.slow();
  const title = uniqueTitle("E2E 계획 프로젝트");
  await page.goto("/projects/new");
  await page.getByLabel("제목", { exact: true }).fill(title);
  await pickOption(page, page.locator("#project-kind"), "일반");
  await pickOption(page, page.locator("#project-status"), "계획");
  await pickOption(page, page.locator("#project-area"), AREA);
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/projects\/(?!new)[^/]+$/, { timeout: 20_000 });
  const projectUrl = page.url();

  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/areas");
  await page.locator("main a[href^='/areas/']", { hasText: AREA }).first().click();
  await expect(page).toHaveURL(/\/areas\/[^/]+$/);

  const board = page.getByRole("list", { name: "상태별 프로젝트" });
  const columns = board.locator(":scope > li");
  await expect(columns).toHaveCount(4);
  const labels = await columns.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  expect(labels.map((l) => l?.replace(/ \d+건$/, ""))).toEqual(["계획", "진행 중", "완료", "보류"]);
  await expect(columns.first().getByRole("link", { name: title })).toBeVisible();

  const goals = page.getByRole("heading", { name: /^목표/ }).first();
  // The heading carries a count ("노트 1") once the area has notes.
  const notes = page.getByRole("heading", { name: /^노트( \d+)?$/ });
  const [g, n, b] = await Promise.all([
    goals.boundingBox(),
    notes.boundingBox(),
    board.boundingBox(),
  ]);
  expect(Math.abs(g!.y - n!.y)).toBeLessThan(4);
  expect(n!.x).toBeGreaterThan(g!.x + 300);
  expect(b!.y).toBeLessThan(g!.y);

  await page.setViewportSize({ width: 390, height: 844 });
  const [g2, n2] = await Promise.all([goals.boundingBox(), notes.boundingBox()]);
  expect(n2!.y).toBeGreaterThan(g2!.y + 20);

  await page.goto(projectUrl);
  await deleteCurrentItem(page);
});
