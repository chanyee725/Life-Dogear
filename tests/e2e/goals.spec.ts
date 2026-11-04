import { expect, test } from "@playwright/test";
import { deleteCurrentItem, uniqueTitle } from "./helpers";

test("목표: 속성이 짝지어 한 줄씩, 상세에 생성일과 빈 섹션 ＋ 추가", async ({ page }) => {
  // First visits compile several pages on the dev server.
  test.setTimeout(120_000);
  await page.goto("/goals/new?horizon=year");

  // 기간 단위 · 기간 and 상태 · 영역 share a row; each control keeps its own label.
  await expect(page.getByText("기간 단위 · 기간")).toBeVisible();
  await expect(page.getByText("상태 · 영역")).toBeVisible();
  const horizon = page.getByLabel("기간 단위", { exact: true });
  const year = page.getByLabel("연도");
  const status = page.getByLabel("상태", { exact: true });
  const area = page.getByLabel("영역", { exact: true });
  const top = async (l: typeof horizon) => (await l.boundingBox())!.y;
  expect(Math.abs((await top(horizon)) - (await top(year)))).toBeLessThan(8);
  expect(Math.abs((await top(status)) - (await top(area)))).toBeLessThan(8);
  await expect(page.getByText("생성일")).toHaveCount(0);

  const title = uniqueTitle("목표 배치");
  await page.getByLabel("제목", { exact: true }).fill(title);
  await year.fill("2027");
  await page.getByLabel("왜").fill("이유 한 줄");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/goals\/(?!new)[^/]+$/, { timeout: 20_000 });
  const id = page.url().split("/").pop()!;

  await expect(page.getByText("생성일")).toBeVisible();
  await expect(page.getByText(/^\d{4}\.\d{2}\.\d{2}$/)).toBeVisible();
  await expect(page.getByLabel("왜")).toHaveValue("이유 한 줄");

  const children = page.getByRole("region", { name: "하위 목표" });
  await expect(children.getByRole("link", { name: "＋ 새 하위 목표" })).toHaveAttribute(
    "href",
    `/goals/new?horizon=quarter&parent=${id}`,
  );
  const projects = page.getByRole("region", { name: "프로젝트" });
  await expect(projects.getByRole("link", { name: "＋ 새 프로젝트" })).toHaveAttribute(
    "href",
    `/projects/new?goal=${id}`,
  );
  await expect(
    page.getByRole("region", { name: "노트" }).getByRole("link", { name: "＋ 새 노트" }),
  ).toBeVisible();

  // Clean up what this test made.
  await deleteCurrentItem(page);
  // The first visit compiles /goals on the dev server.
  await expect(page).toHaveURL(/\/goals$/, { timeout: 20_000 });
});
