import { expect, test } from "@playwright/test";
import { createItem, deleteCurrentItem, uniqueTitle, type Section } from "./helpers";

const SECTIONS: { section: Section; label: string }[] = [
  { section: "projects", label: "프로젝트" },
  { section: "papers", label: "논문" },
  { section: "seminars", label: "활동" },
  { section: "thoughts", label: "생각" },
];

for (const { section, label } of SECTIONS) {
  test(`${label}: create → detail → edit → delete`, async ({ page }) => {
    const title = uniqueTitle(`E2E ${section}`);
    const edited = `${title} (edited)`;

    await createItem(page, section, title);

    // Edit the title; it autosaves (저장 saves at once) and survives a reload.
    const titleField = page.getByLabel("제목", { exact: true });
    await titleField.fill(edited);
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByText("저장됨", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("제목", { exact: true })).toHaveValue(edited);

    // It appears in the list.
    await page.goto(`/${section}`);
    await expect(page.getByText(edited).first()).toBeVisible();

    // Delete from the detail page and confirm it is gone from the list.
    await page.getByText(edited).first().click();
    await deleteCurrentItem(page);
    await expect(page).toHaveURL(new RegExp(`/${section}$`));
    await expect(page.getByText(edited)).toHaveCount(0);
  });
}

test("빈 제목은 저장되지 않는다", async ({ page }) => {
  await page.goto("/thoughts/new");
  await page.getByLabel("제목", { exact: true }).fill("   ");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("제목을 입력하세요.")).toBeVisible();
  await expect(page).toHaveURL(/\/thoughts\/new$/);
});

test("자동 저장: 편집은 잠시 뒤 저장되고, 바로 떠나도 남는다", async ({ page }) => {
  const title = uniqueTitle("E2E autosave");
  await createItem(page, "thoughts", title);
  const detailUrl = page.url();
  const titleField = page.getByLabel("제목", { exact: true });

  // Typing shows 저장 안 됨, then autosaves about a second later.
  const first = `${title} (auto)`;
  await titleField.fill(first);
  await expect(page.getByText("저장 안 됨")).toBeVisible();
  await expect(page.getByText("저장됨", { exact: true })).toBeVisible();
  await page.reload();
  await expect(titleField).toHaveValue(first);

  // Leaving right after an edit (before the autosave delay) still keeps it.
  const second = `${title} (leave)`;
  await titleField.fill(second);
  page.on("dialog", (d) => d.accept());
  // The pending edit is sent as a server action when the page unmounts.
  const saved = page.waitForResponse(
    (r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined,
  );
  await page
    .getByRole("navigation", { name: "주 메뉴" })
    .getByRole("link", { name: "논문" })
    .click();
  await expect(page).toHaveURL(/\/papers$/);
  await saved;
  await page.goto(detailUrl);
  await expect(page.getByLabel("제목", { exact: true })).toHaveValue(second);
});

test("저장 토스트: 저장·Cmd+S면 오른쪽 위에 하나만, 자동 저장이면 없음", async ({ page }) => {
  const title = uniqueTitle("E2E toast");
  await createItem(page, "thoughts", title);
  const titleField = page.getByLabel("제목", { exact: true });
  const toast = page.getByRole("status").filter({ hasText: "저장되었습니다" });

  // Autosave: 저장됨 in the header, no toast.
  await titleField.fill(`${title} (auto)`);
  await expect(page.getByText("저장됨", { exact: true })).toBeVisible();
  await expect(toast).toHaveCount(0);

  // 저장: one toast at the top right, gone after ~2.5 s.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(toast).toHaveCount(1);
  // sonner slides it in from above: measure once it has settled.
  const save = (await page.getByRole("button", { name: "저장", exact: true }).boundingBox())!;
  await expect
    .poll(async () => (await toast.boundingBox())!.y)
    .toBeGreaterThanOrEqual(save.y + save.height);
  const box = (await toast.boundingBox())!;
  expect(1280 - (box.x + box.width)).toBeLessThan(40);
  // Below the header's buttons (저장 sits in the top right corner).
  expect(box.y).toBeGreaterThanOrEqual(save.y + save.height);
  expect(box.y).toBeLessThan(100);
  await page.mouse.move(0, 400); // keep the pointer off it (hover pauses the timer)
  await page.screenshot({ path: "test-results/save-toast-1280-light.png" });

  // Saving again keeps one toast; Cmd/Ctrl+S counts as an explicit save.
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await titleField.press("ControlOrMeta+s");
  await expect(toast).toHaveCount(1);
  await expect(toast).toHaveCount(0, { timeout: 5_000 });

  await page.getByRole("radio", { name: "다크" }).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(toast).toHaveCount(1);
  await page.mouse.move(0, 400);
  await page.screenshot({ path: "test-results/save-toast-1280-dark.png" });
  await page.getByRole("radio", { name: "라이트" }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await titleField.press("ControlOrMeta+s");
  await expect(toast).toHaveCount(1);
  // Phones: top corner, above the header row (더보기 · 저장).
  const narrow = (await toast.boundingBox())!;
  expect(narrow.y).toBeLessThan(40);
  for (const name of ["더보기", "저장"]) {
    const b = (await page.getByRole("button", { name, exact: true }).first().boundingBox())!;
    expect(narrow.y + narrow.height).toBeLessThanOrEqual(b.y);
  }
  await page.screenshot({ path: "test-results/save-toast-390.png" });

  await deleteCurrentItem(page);
});
