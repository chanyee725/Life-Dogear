import { describe, expect, it } from "vitest";
import {
  clamp,
  clampScroll,
  clampZoom,
  DRAG_THRESHOLD,
  focusScroll,
  isDrag,
  MAX_ZOOM,
  MIN_ZOOM,
  wheelZoom,
  zoomScroll,
} from "@/app/roadmap/useViewport";

describe("clamp / clampZoom", () => {
  it("keeps values inside the range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it("limits zoom to 0.5..2", () => {
    expect(clampZoom(0.1)).toBe(MIN_ZOOM);
    expect(clampZoom(9)).toBe(MAX_ZOOM);
    expect(clampZoom(1.25)).toBe(1.25);
  });
});

describe("isDrag", () => {
  it("treats small moves as a click", () => {
    expect(isDrag(0, 0)).toBe(false);
    expect(isDrag(2, 2)).toBe(false);
  });

  it("treats moves at or past the threshold as a drag, in any direction", () => {
    expect(isDrag(DRAG_THRESHOLD, 0)).toBe(true);
    expect(isDrag(0, -DRAG_THRESHOLD)).toBe(true);
    expect(isDrag(3, 3)).toBe(true);
  });
});

describe("wheelZoom", () => {
  it("wheel up zooms in, wheel down zooms out", () => {
    expect(wheelZoom(1, -100)).toBeGreaterThan(1);
    expect(wheelZoom(1, 100)).toBeLessThan(1);
  });

  it("one notch in then out returns to the start", () => {
    expect(wheelZoom(wheelZoom(1, -100), 100)).toBeCloseTo(1);
  });

  it("stays within the zoom range", () => {
    expect(wheelZoom(1.9, -10_000)).toBe(MAX_ZOOM);
    expect(wheelZoom(0.6, 10_000)).toBe(MIN_ZOOM);
  });
});

describe("clampScroll", () => {
  const viewport = { width: 400, height: 300 };

  it("clamps into 0..content-viewport", () => {
    expect(clampScroll({ left: -10, top: 900 }, { width: 1000, height: 800 }, viewport)).toEqual({
      left: 0,
      top: 500,
    });
  });

  it("pins to 0 when the content fits", () => {
    expect(clampScroll({ left: 50, top: 50 }, { width: 200, height: 100 }, viewport)).toEqual({
      left: 0,
      top: 0,
    });
  });
});

describe("zoomScroll", () => {
  it("keeps the layout point under the cursor fixed", () => {
    const scroll = { left: 120, top: 80 };
    const anchor = { x: 200, y: 150 };
    const from = 1;
    const to = 1.5;
    const next = zoomScroll(scroll, from, to, anchor);
    const before = { x: (scroll.left + anchor.x) / from, y: (scroll.top + anchor.y) / from };
    const after = { x: (next.left + anchor.x) / to, y: (next.top + anchor.y) / to };
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it("zooming at the top-left corner scales the scroll offset", () => {
    expect(zoomScroll({ left: 100, top: 40 }, 1, 2, { x: 0, y: 0 })).toEqual({
      left: 200,
      top: 80,
    });
  });

  it("is a no-op when the zoom does not change", () => {
    expect(zoomScroll({ left: 33, top: 44 }, 1.2, 1.2, { x: 10, y: 20 })).toEqual({
      left: 33,
      top: 44,
    });
  });
});

describe("focusScroll", () => {
  const viewport = { width: 800, height: 400 };
  const content = { width: 3000, height: 2000 };

  it("puts the rect at the left margin and centres it vertically", () => {
    const rect = { x: 100, y: 500, width: 232, height: 56 };
    expect(focusScroll(rect, 1, viewport, content, 24)).toEqual({ left: 76, top: 328 });
  });

  it("accounts for zoom", () => {
    const rect = { x: 100, y: 500, width: 232, height: 56 };
    expect(focusScroll(rect, 2, viewport, content, 24)).toEqual({ left: 176, top: 856 });
  });

  it("clamps at the origin for a root near the top-left", () => {
    expect(focusScroll({ x: 0, y: 0, width: 232, height: 56 }, 1, viewport, content)).toEqual({
      left: 0,
      top: 0,
    });
  });
});
