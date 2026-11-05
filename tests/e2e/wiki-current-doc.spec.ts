import { expect, test } from "@playwright/test";
import { createItem, deleteCurrentItem, uniqueTitle } from "./helpers";

// Detail URLs are `<slug>-<shortid>`: the editor must know its item without parsing the URL.
test("slug URL: [[link]] → 생각으로 만들기 links back, renaming offers to update [[links]]", async ({
  page,
}) => {
  const host = uniqueTitle("위키 출처");
  const ghost = uniqueTitle("위키 새 생각");
  await createItem(page, "thoughts", host);
  const hostUrl = page.url();
  expect(new URL(hostUrl).pathname).toMatch(/-[0-9a-f]{8}$/);

  const body = page.getByRole("textbox", { name: "본문" });
  await body.click();
  await page.keyboard.type(`[[${ghost}`);
  await expect(page.getByRole("listbox").getByText(ghost)).toBeVisible();
  await page.keyboard.press("Enter");
  const link = body.locator(`[data-wikilink="${ghost}"]`);
  await expect(link).toBeVisible();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText("저장됨", { exact: true })).toBeVisible();

  await link.click();
  await page.getByRole("button", { name: `‘${ghost}’ 생각으로 만들기` }).click();
  const connected = page.getByRole("region", { name: "연결된 항목" });
  const ghostLink = connected.getByRole("link", { name: ghost });
  await expect(ghostLink).toBeVisible({ timeout: 10_000 });

  // On the new thought's slug URL, renaming it asks to update [[ghost]] in the host body.
  await page.goto((await ghostLink.getAttribute("href"))!);
  expect(new URL(page.url()).pathname).toMatch(/-[0-9a-f]{8}$/);
  await page.getByLabel("제목", { exact: true }).fill(`${ghost} 2`);
  await expect(page.getByText("다른 본문의 링크도 바꿀까요?")).toBeVisible({ timeout: 10_000 });

  await page.goto(page.url());
  await deleteCurrentItem(page);
  await page.goto(hostUrl);
  await deleteCurrentItem(page);
});
