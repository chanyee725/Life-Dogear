import { expect, test } from "@playwright/test";

// The sidebar footer (설정 + theme) must never cover the menu above it:
// the menu scrolls instead. Checked at desktop, small laptop and phone (drawer) sizes.
for (const vp of [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
]) {
  test(`사이드바 아래 묶음이 메뉴를 가리지 않는다 (${vp.width}×${vp.height})`, async ({ page }) => {
    await page.setViewportSize(vp);
    await page.goto("/");
    if (vp.width < 768) await page.getByRole("button", { name: "사이드바 열기" }).click();

    const nav = page.getByRole("navigation", { name: "주 메뉴" });
    const archive = nav.getByRole("link", { name: "보관함" });
    const aside = page.locator("aside").filter({ has: nav });
    const settings = aside.getByRole("link", { name: "설정", exact: true });
    const theme = page
      .getByRole("radiogroup", { name: "화면 테마" })
      .or(page.getByRole("group", { name: "화면 테마" }));

    await archive.scrollIntoViewIfNeeded();
    const a = (await archive.boundingBox())!;
    const n = (await nav.boundingBox())!;
    const s = (await settings.boundingBox())!;
    // Last menu item is fully inside the scroll area, and the scroll area ends above 설정.
    expect(a.y + a.height).toBeLessThanOrEqual(n.y + n.height + 0.5);
    expect(n.y + n.height).toBeLessThanOrEqual(s.y + 0.5);

    // Accent is fixed to mono: no colour switch, no data-accent, and the theme switch is shown.
    await expect(page.getByRole("group", { name: "포인트 컬러" })).toHaveCount(0);
    await expect(page.locator("html")).not.toHaveAttribute("data-accent", /.+/);
    expect((await theme.first().boundingBox())!.y).toBeGreaterThan(n.y + n.height - 1);
  });
}

test("예전에 저장된 포인트 컬러 값이 있어도 모노로 보이고 저장값은 지워진다", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("rb-accent", "terracotta"));
  await page.goto("/");
  const accent = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--rb-accent").trim(),
  );
  expect(accent).toBe("#37352f");
  expect(await page.evaluate(() => localStorage.getItem("rb-accent"))).toBeNull();
});
