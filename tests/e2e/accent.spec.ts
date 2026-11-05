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

test("포인트 컬러: 모노는 잉크색 accent와 따뜻한 회색 바탕을 쓰고 새로고침 후에도 유지된다", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  const mono = page.getByRole("button", { name: "포인트 컬러: 모노" });
  const token = (name: string) =>
    page.evaluate(
      (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
      name,
    );

  await mono.click();
  await expect(html).toHaveAttribute("data-accent", "mono");
  await expect(mono).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => localStorage.getItem("rb-accent"))).toBe("mono");
  // Light vs dark depends on the system theme the browser reports.
  const dark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  expect(await token("--rb-accent")).toBe(dark ? "#e6e5e3" : "#37352f");
  expect(await token("--rb-surface")).toBe(dark ? "#202020" : "#f7f6f3");

  await page.reload();
  await expect(html).toHaveAttribute("data-accent", "mono");
  await expect(mono).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "포인트 컬러: 파랑" }).click();
  await expect(html).not.toHaveAttribute("data-accent", /.+/);
  expect(await token("--rb-surface")).not.toBe("#f7f6f3");
});
