import { expect, test, type Page } from "@playwright/test";
import { uniqueTitle } from "./helpers";

const editor = (page: Page) => page.getByRole("textbox", { name: "본문" });
const kindSelect = (page: Page) => page.getByLabel("종류", { exact: true });

test("새 프로젝트 템플릿: 종류가 같이 바뀌고, 직접 쓴 본문은 유지되고, 저장된다", async ({
  page,
}) => {
  await page.goto("/projects/new?kind=general");
  const group = page.getByRole("radiogroup", { name: "템플릿" });
  await expect(group.getByRole("radio")).toHaveText([
    "빈 페이지",
    "연구(논문)",
    "일반 프로젝트",
    "공부",
    "개발",
  ]);
  await expect(group.getByRole("radio", { name: "일반 프로젝트" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(editor(page).locator("h2").first()).toHaveText("목표·완료 기준");

  // Research template: 종류 follows.
  await group.getByRole("radio", { name: "연구(논문)" }).click();
  await expect(kindSelect(page)).toHaveValue("research");
  await expect(editor(page).locator("h2").first()).toHaveText("진행 체크리스트");

  // Dev template over the untouched research body: replaced, 종류 back to general.
  await group.getByRole("radio", { name: "개발" }).click();
  await expect(kindSelect(page)).toHaveValue("general");
  await expect(editor(page).locator("h2").first()).toHaveText("목표·요구사항");

  // The user writes: a later choice keeps the body but still sets 종류.
  await editor(page).locator("h2").first().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" MoveIt2");
  await group.getByRole("radio", { name: "연구(논문)" }).click();
  await expect(kindSelect(page)).toHaveValue("research");
  await expect(editor(page).locator("h2").first()).toHaveText("목표·요구사항 MoveIt2");
  await expect(page.getByText("본문이 있어 템플릿을 적용하지 않았습니다.")).toBeVisible();

  // Saving keeps the body as written.
  const title = uniqueTitle("템플릿 프로젝트");
  await page.getByLabel("제목", { exact: true }).fill(title);
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/projects\/(?!new)[^/]+$/, { timeout: 20_000 });
  await expect(editor(page).locator("h2").first()).toHaveText("목표·요구사항 MoveIt2");
  await expect(kindSelect(page)).toHaveValue("research");
});
