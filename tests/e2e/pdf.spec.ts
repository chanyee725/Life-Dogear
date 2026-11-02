import { expect, test, type Page } from "@playwright/test";

const PAPER = "seed-paper-2"; // seed: reading, page 7 of 10
const READ_URL = `/papers/${PAPER}/read`;

const pageInput = (page: Page) => page.getByRole("textbox", { name: "쪽 번호" });
const scroller = (page: Page) => page.getByLabel("PDF 본문");

test("PDF 뷰어: 스크롤 → 저장 → 새로고침 시 같은 쪽 근처로 복원", async ({ page }) => {
  await page.goto(READ_URL);
  await expect(scroller(page)).toBeVisible();
  // Seeded position (page 7) is restored on first open.
  await expect(pageInput(page)).toHaveValue("7", { timeout: 15_000 });

  // Scroll up to page 3 via the page box; wait for the debounced save.
  const saved = page.waitForResponse(
    (r) => r.url().includes(`/api/papers/${PAPER}/progress`) && r.request().method() !== "GET",
  );
  await pageInput(page).fill("3");
  await pageInput(page).press("Enter");
  await expect(pageInput(page)).toHaveValue("3");
  expect((await saved).status()).toBe(204);

  // Reload: lands on the same page, not on page 1.
  await page.reload();
  await expect(pageInput(page)).toHaveValue("3", { timeout: 15_000 });

  // Re-open from the paper detail page too.
  await page.goto(`/papers/${PAPER}`);
  await page.getByRole("link", { name: /이어 읽기/ }).click();
  await expect(page).toHaveURL(new RegExp(`${PAPER}/read$`));
  await expect(pageInput(page)).toHaveValue("3", { timeout: 15_000 });
});

test("PDF 뷰어: 경계 쪽 이동은 1~마지막 쪽으로 제한된다", async ({ page }) => {
  await page.goto(READ_URL);
  await expect(pageInput(page)).toHaveValue(/\d+/, { timeout: 15_000 });
  await pageInput(page).fill("999");
  await pageInput(page).press("Enter");
  await expect(pageInput(page)).toHaveValue("10");
  await expect(page.getByRole("button", { name: "다음 쪽" })).toBeDisabled();
  await pageInput(page).fill("1");
  await pageInput(page).press("Enter");
  await expect(page.getByRole("button", { name: "이전 쪽" })).toBeDisabled();
});

test("PDF 없는 논문의 뷰어/진행 API는 실패 경로로 처리된다", async ({ page, request }) => {
  const res = await request.get("/api/papers/seed-paper-4/pdf");
  expect(res.status()).toBe(404);
  const bad = await request.put(`/api/papers/${PAPER}/progress`, {
    data: "not json",
    headers: { "content-type": "text/plain" },
  });
  expect(bad.status()).toBe(400);
  const traversal = await request.get("/api/papers/..%2F..%2Fetc%2Fpasswd/pdf");
  expect([400, 404]).toContain(traversal.status());
  await page.goto("/papers/seed-paper-4");
  await expect(page.getByRole("link", { name: /이어 읽기/ })).toHaveCount(0);
});
