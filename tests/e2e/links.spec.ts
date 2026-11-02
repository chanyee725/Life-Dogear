import { expect, test } from "@playwright/test";
import { uniqueTitle } from "./helpers";

test("상세에서 연결 추가 → 양쪽에 표시 → 해제", async ({ page }) => {
  const title = uniqueTitle("E2E link");

  await page.goto("/thoughts/new");
  await page.getByLabel("제목").first().fill(title);
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/thoughts\/(?!new)[^/]+$/);
  const thoughtUrl = page.url();

  // Link to a seeded paper through the title search picker.
  const section = page.getByRole("region", { name: "연결된 항목" });
  await section.getByRole("button", { name: /연결 추가/ }).click();
  await page.getByRole("combobox").or(page.getByRole("searchbox")).first().fill("Note-Taking");
  await page.getByText("Note-Taking Tools and Depth of Literature Review").first().click();
  await expect(section.getByText("Note-Taking Tools and Depth of Literature Review")).toBeVisible();

  // The paper side shows the thought too (links are bidirectional in the UI).
  await page.goto("/papers/seed-paper-1");
  await expect(page.getByText(title)).toBeVisible();

  // Unlink from the thought side.
  await page.goto(thoughtUrl);
  await section
    .getByRole("button", { name: /연결 해제|삭제/ })
    .first()
    .click();
  await expect(section.getByText("Note-Taking Tools and Depth of Literature Review")).toHaveCount(
    0,
  );
  await page.goto("/papers/seed-paper-1");
  await expect(page.getByText(title)).toHaveCount(0);
});
