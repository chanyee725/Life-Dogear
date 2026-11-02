import { describe, expect, it } from "vitest";
import {
  computeLayout,
  positionAt,
  samePosition,
  scrollTopFor,
  visibleRange,
} from "@/components/pdf/layout";

// 5 pages of 1000px, 20px gap, 16px padding → tops 16, 1036, 2056, 3076, 4096
const layout = computeLayout([1000, 1000, 1000, 1000, 1000], 20, 16);

describe("pdf layout", () => {
  it("stacks pages", () => {
    expect(layout.tops).toEqual([16, 1036, 2056, 3076, 4096]);
    expect(layout.height).toBe(5112);
    expect(computeLayout([], 20, 16).height).toBe(32);
  });

  it("maps scroll offsets to positions", () => {
    expect(positionAt(layout, 0, 800)).toEqual({ page: 1, scroll: 0 });
    expect(positionAt(layout, 516, 800)).toEqual({ page: 1, scroll: 0.5 });
    expect(positionAt(layout, 1030, 800)).toEqual({ page: 1, scroll: 1 }); // in the gap
    expect(positionAt(layout, 2306, 800)).toEqual({ page: 3, scroll: 0.25 });
  });

  it("reports the last page at the end of the document", () => {
    const max = layout.height - 800;
    expect(positionAt(layout, max, 800)?.page).toBe(5);
  });

  it("round-trips positions through scroll offsets", () => {
    for (const position of [
      { page: 1, scroll: 0 },
      { page: 2, scroll: 0.5 },
      { page: 4, scroll: 0.9 },
    ]) {
      const top = scrollTopFor(layout, position);
      expect(samePosition(positionAt(layout, top, 800), position)).toBe(true);
    }
  });

  it("restores into a re-scaled layout", () => {
    const zoomed = computeLayout([1500, 1500, 1500, 1500, 1500], 20, 16);
    const top = scrollTopFor(zoomed, { page: 3, scroll: 0.4 });
    expect(positionAt(zoomed, top, 800)).toEqual({ page: 3, scroll: 0.4 });
  });

  it("clamps out-of-range positions", () => {
    expect(scrollTopFor(layout, { page: 0, scroll: -1 })).toBe(16);
    expect(scrollTopFor(layout, { page: 99, scroll: 2 })).toBe(5096);
    expect(scrollTopFor(computeLayout([], 20, 16), { page: 3, scroll: 0 })).toBe(0);
  });

  it("finds pages near the viewport", () => {
    expect(visibleRange(layout, 0, 800, 0)).toEqual([0, 0]);
    expect(visibleRange(layout, 1500, 800, 800)).toEqual([0, 3]);
    expect(visibleRange(computeLayout([], 20, 16), 0, 800, 0)).toEqual([0, -1]);
  });
});
