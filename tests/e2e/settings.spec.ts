import { expect, test } from "@playwright/test";

// /settings: reached from the sidebar and from the calendar's '설정 필요'; a saved iCal address
// shows only masked (scheme + host) and never reaches the page in full.
// Placeholder address only; never a real calendar.
const FEED = "https://calendar.example/ics/e2e-secret-token-qqqq/basic.ics";

test("calendar '설정 필요' opens settings; a saved iCal address shows masked", async ({ page }) => {
  await page.goto("/tasks?view=calendar");
  await page.getByRole("link", { name: "설정 필요" }).click();
  await expect(page).toHaveURL(/\/settings#calendar-write$/);
  await expect(
    page.locator("aside").getByRole("link", { name: "설정", exact: true }),
  ).toBeVisible();

  const read = page.getByRole("region", { name: "Google 캘린더 읽기" });
  await expect(read.getByText("연결 안 됨")).toBeVisible();
  await read.getByLabel("iCal 비공개 주소", { exact: true }).fill(FEED);
  await read.getByRole("button", { name: "저장" }).click();

  await expect(read.getByText("https://calendar.example/••••••")).toBeVisible();
  await expect(read.getByText("현재: 앱에 저장됨")).toBeVisible();
  await expect(read.getByLabel("iCal 비공개 주소", { exact: true })).toHaveValue("");
  await page.reload();
  expect(await page.content()).not.toContain("e2e-secret-token");
  await expect(read.getByText("연결됨", { exact: true })).toBeVisible();

  await read.getByRole("button", { name: "앱 설정 지우기" }).click();
  await expect(read.getByText("현재: 설정 안 됨")).toBeVisible();
});
