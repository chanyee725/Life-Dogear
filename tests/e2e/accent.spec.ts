import { expect, test } from "@playwright/test";

test("포인트 컬러: 테라코타로 바꾸면 저장되고 새로고침 후에도 유지된다", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  const blue = page.getByRole("button", { name: "포인트 컬러: 파랑" });
  const terracotta = page.getByRole("button", { name: "포인트 컬러: 테라코타" });

  await expect(html).not.toHaveAttribute("data-accent", /.+/);
  await expect(blue).toHaveAttribute("aria-pressed", "true");

  await terracotta.click();
  await expect(html).toHaveAttribute("data-accent", "terracotta");
  await expect(terracotta).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => localStorage.getItem("rb-accent"))).toBe("terracotta");
  const accent = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--rb-accent").trim(),
  );
  expect(accent).toBe("#b8461a");

  await page.reload();
  await expect(html).toHaveAttribute("data-accent", "terracotta");
  await expect(terracotta).toHaveAttribute("aria-pressed", "true");

  await blue.click();
  await expect(html).not.toHaveAttribute("data-accent", /.+/);
  expect(await page.evaluate(() => localStorage.getItem("rb-accent"))).toBeNull();
});
