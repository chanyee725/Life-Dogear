import { expect, test } from "@playwright/test";

// Seed: tag "지식관리" is on project 1, paper 1 and seminar 1.
test("태그 모아보기: /tags → 태그 → 해당 항목 목록", async ({ page }) => {
  await page.goto("/tags");
  await page
    .getByRole("link", { name: /지식관리/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "#지식관리" })).toBeVisible();
  await expect(page.getByRole("link", { name: "대학원생 연구 노트 습관 연구" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Note-Taking Tools and Depth of Literature Review" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "연구 노트와 지식 관리" })).toBeVisible();
  // An item without this tag is not listed.
  await expect(
    page.getByRole("link", { name: "Compact Language Models for Domain Summarization" }),
  ).toHaveCount(0);
});
