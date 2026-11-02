import { expect, test } from "@playwright/test";
import { createItem, deleteCurrentItem, uniqueTitle, type Section } from "./helpers";

const SECTIONS: { section: Section; label: string }[] = [
  { section: "projects", label: "연구" },
  { section: "papers", label: "논문" },
  { section: "seminars", label: "세미나" },
  { section: "thoughts", label: "생각" },
];

for (const { section, label } of SECTIONS) {
  test(`${label}: create → detail → edit → delete`, async ({ page }) => {
    const title = uniqueTitle(`E2E ${section}`);
    const edited = `${title} (edited)`;

    await createItem(page, section, title);

    // Edit the title and save; the change survives a reload.
    const titleField = page.getByLabel("제목", { exact: true });
    await titleField.fill(edited);
    await page.getByRole("button", { name: "저장" }).click();
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

test("저장 안 된 수정이 있으면 사이드바 이동 전에 확인한다", async ({ page }) => {
  const title = uniqueTitle("E2E unsaved");
  await createItem(page, "thoughts", title);
  const detailUrl = page.url();

  const titleField = page.getByLabel("제목", { exact: true });
  const edited = `${title} (unsaved)`;
  await titleField.fill(edited);
  await expect(page.getByText("저장 안 됨")).toBeVisible();

  const sidebarLink = page.getByRole("navigation", { name: "주 메뉴" }).getByRole("link", {
    name: "논문",
  });

  // Cancel the confirm: stay on the page and keep the typed value.
  page.once("dialog", (d) => d.dismiss());
  await sidebarLink.click();
  await expect(page).toHaveURL(detailUrl);
  await expect(titleField).toHaveValue(edited);
  await expect(page.getByText("저장 안 됨")).toBeVisible();

  // Accept the confirm: navigate away to /papers.
  page.once("dialog", (d) => d.accept());
  await sidebarLink.click();
  await expect(page).toHaveURL(/\/papers$/);
});
