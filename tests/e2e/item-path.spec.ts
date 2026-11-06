import { expect, test } from "@playwright/test";
import { createItem, deleteCurrentItem, uniqueTitle } from "./helpers";

test("detail pages live at /<kind>/<slug>-<shortid>; old UUID URLs 308 there", async ({ page }) => {
  const title = uniqueTitle("E2E 주소 테스트");
  await createItem(page, "projects", title);

  const slug = title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-");
  const path = decodeURIComponent(new URL(page.url()).pathname);
  expect(path).toMatch(new RegExp(`^/projects/${slug}-[0-9a-f]{8}$`));
  const short = path.slice(-8);

  // The full id comes from search (same-origin API), not from the URL any more.
  const res = await page.request.get(`/api/search?q=${encodeURIComponent(title)}`);
  const { hits } = (await res.json()) as { hits: { type: string; id: string }[] };
  const id = hits.find((h) => h.type === "project" && h.id.startsWith(short))?.id;
  expect(id, "project in search hits").toBeTruthy();

  // Old full-UUID URL, bare short id and a stale slug all redirect permanently.
  for (const old of [`/projects/${id}`, `/projects/${short}`, `/projects/old-title-${short}`]) {
    const r = await page.request.get(old, { maxRedirects: 0 });
    expect(r.status(), old).toBe(308);
    expect(decodeURIComponent(r.headers()["location"] ?? "")).toBe(path);
  }

  // Following the old URL lands on the item.
  await page.goto(`/projects/${id}`);
  await expect(page).toHaveURL((url) => decodeURIComponent(url.pathname) === path);
  await expect(page.getByLabel("제목", { exact: true })).toHaveValue(title);

  // Malformed or unknown refs are 404s.
  for (const bad of ["/projects/not-an-id", "/projects/slug-00000000"]) {
    expect((await page.request.get(bad, { maxRedirects: 0 })).status(), bad).toBe(404);
  }

  await deleteCurrentItem(page);
});
