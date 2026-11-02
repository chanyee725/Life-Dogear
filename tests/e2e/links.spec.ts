import { expect, test } from "@playwright/test";
import { uniqueTitle } from "./helpers";

const PAPER_TITLE = "Note-Taking Tools and Depth of Literature Review";

test("상세에서 연결 추가 → 양쪽에 표시 → 해제", async ({ page }) => {
  const title = uniqueTitle("E2E link");

  await page.goto("/thoughts/new");
  await page.getByLabel("제목").first().fill(title);
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/thoughts\/(?!new)[^/]+$/);
  const thoughtUrl = page.url();

  // Link to a seeded paper through the title search picker (dialog).
  const section = page.getByRole("region", { name: "연결된 항목" });
  await section.getByRole("button", { name: "연결 추가", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("searchbox").fill("Note-Taking");
  await dialog.getByRole("button", { name: new RegExp(PAPER_TITLE) }).click();
  await expect(dialog).toBeHidden();
  await expect(section.getByRole("link", { name: PAPER_TITLE })).toBeVisible();

  // The paper side shows the thought too (links are bidirectional in the UI).
  await page.goto("/papers/seed-paper-1");
  await expect(
    page.getByRole("region", { name: "연결된 항목" }).getByRole("link", { name: title }),
  ).toBeVisible();

  // Unlink from the thought side: every row's button is named "연결 해제",
  // so scope to the row (li) that holds the paper link.
  await page.goto(thoughtUrl);
  const row = section.getByRole("listitem").filter({
    has: page.getByRole("link", { name: PAPER_TITLE }),
  });
  await row.getByRole("button", { name: "연결 해제" }).click();
  await expect(section.getByRole("link", { name: PAPER_TITLE })).toHaveCount(0);

  await page.goto("/papers/seed-paper-1");
  await expect(
    page.getByRole("region", { name: "연결된 항목" }).getByRole("link", { name: title }),
  ).toHaveCount(0);
});

test("이미 연결된 항목은 피커에서 다시 선택할 수 없다", async ({ page }) => {
  await page.goto("/papers/seed-paper-1");
  const section = page.getByRole("region", { name: "연결된 항목" });
  await section.getByRole("button", { name: "연결 추가", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("searchbox").fill("노트");
  // seed-project-1 is already linked to seed-paper-1.
  await expect(dialog.getByRole("button", { name: /대학원생 연구 노트 습관 연구/ })).toBeDisabled();
  await dialog.getByRole("searchbox").fill("zzzz-no-such-title");
  await expect(dialog.getByText("검색 결과가 없습니다.")).toBeVisible();
});
