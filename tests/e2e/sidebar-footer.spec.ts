import { expect, test } from "@playwright/test";

// The sidebar footer (설정 + theme + accent dots) must never cover the menu above it:
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
    const accent = page.getByRole("group", { name: "포인트 컬러" });

    await archive.scrollIntoViewIfNeeded();
    const a = (await archive.boundingBox())!;
    const n = (await nav.boundingBox())!;
    const s = (await settings.boundingBox())!;
    // Last menu item is fully inside the scroll area, and the scroll area ends above 설정.
    expect(a.y + a.height).toBeLessThanOrEqual(n.y + n.height + 0.5);
    expect(n.y + n.height).toBeLessThanOrEqual(s.y + 0.5);

    // Theme switch and the three accent dots share one row.
    const t = (await theme.first().boundingBox())!;
    const c = (await accent.boundingBox())!;
    expect(Math.abs(t.y + t.height / 2 - (c.y + c.height / 2))).toBeLessThan(4);
    await expect(accent.getByRole("button")).toHaveCount(3);
  });
}
