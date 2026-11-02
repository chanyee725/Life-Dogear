import { expect, test } from "@playwright/test";
import { createItem, deleteCurrentItem, uniqueTitle, type Section } from "./helpers";

const SECTIONS: { section: Section; label: string }[] = [
  { section: "projects", label: "프로젝트" },
  { section: "papers", label: "논문" },
  { section: "seminars", label: "세미나" },
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
