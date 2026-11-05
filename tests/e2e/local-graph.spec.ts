import { expect, test } from "@playwright/test";

// seed-paper-1 is linked to seed-project-1, so its local graph has at least two nodes.
test("로컬 그래프: 클릭 후에만 휠 확대, 화면 맞춤 버튼", async ({ page }) => {
  await page.goto("/papers/seed-paper-1");
  const graph = page.getByRole("application", { name: /로컬 그래프/ });
  await graph.scrollIntoViewIfNeeded();
  await expect(graph.locator("canvas")).toBeVisible();

  // Taller on wide screens (lg: 360px).
  const box = await graph.boundingBox();
  expect(box?.height).toBe(360);

  // Record whether d3-zoom took each wheel: it cancels the page scroll (and stops propagation,
  // so capture on window and read defaultPrevented after dispatch).
  await page.evaluate(() => {
    const w = window as unknown as { wheels: WheelEvent[] };
    w.wheels = [];
    window.addEventListener("wheel", (e) => w.wheels.push(e), { capture: true, passive: true });
  });
  const wheels = () =>
    page.evaluate(() =>
      (window as unknown as { wheels: WheelEvent[] }).wheels.map((e) => e.defaultPrevented),
    );
  const cx = box!.x + 20;
  const cy = box!.y + box!.height - 20;

  // Not active yet: the wheel scrolls the page.
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, -100);
  await expect.poll(wheels).toEqual([false]);
  await expect(graph).toHaveAttribute("data-wheel-zoom", "off");

  // Click the background (pan surface) → wheel zooms the graph.
  await page.mouse.click(cx, cy);
  await expect(graph).toHaveAttribute("data-wheel-zoom", "on");
  await expect(graph).toBeFocused();
  await page.mouse.wheel(0, -100);
  await expect.poll(wheels).toEqual([false, true]);

  // Fit button sits inside the graph and keeps it active.
  await graph.getByRole("button", { name: "화면에 맞춤" }).click();
  await expect(graph).toHaveAttribute("data-wheel-zoom", "on");

  // Focus leaves the graph → the wheel goes back to the page.
  await page.getByRole("link", { name: "전체 그래프" }).focus();
  await expect(graph).toHaveAttribute("data-wheel-zoom", "off");
});
