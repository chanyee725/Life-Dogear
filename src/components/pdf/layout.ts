/**
 * Geometry for a vertically stacked list of pages, independent of the DOM so
 * that saving and restoring a reading position is deterministic and testable.
 *
 * A position is `{ page, scroll }`: the 1-based page at the top edge of the
 * viewport and how far (0–1) that edge is into the page.
 */
export type Position = { page: number; scroll: number };

export type Layout = {
  tops: number[];
  heights: number[];
  /** Total content height including padding. */
  height: number;
};

export function computeLayout(heights: number[], gap: number, padding: number): Layout {
  const tops: number[] = [];
  let y = padding;
  for (const h of heights) {
    tops.push(y);
    y += h + gap;
  }
  const height = heights.length ? y - gap + padding : padding * 2;
  return { tops, heights, height };
}

/** Index of the last page whose top is at or above `y` (0 when above the first page). */
function indexAt(layout: Layout, y: number): number {
  const { tops } = layout;
  let lo = 0;
  let hi = tops.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (tops[mid] <= y) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Position for a scroll offset. When scrolled to the very end, reports the last
 * page so a short final page still counts as reached.
 */
export function positionAt(
  layout: Layout,
  scrollTop: number,
  viewportHeight: number,
): Position | null {
  const count = layout.tops.length;
  if (!count) return null;
  if (count > 1 && scrollTop + viewportHeight >= layout.height - 2) {
    const last = count - 1;
    return {
      page: count,
      scroll: clamp01((scrollTop - layout.tops[last]) / layout.heights[last]),
    };
  }
  const i = indexAt(layout, scrollTop);
  const h = layout.heights[i];
  return { page: i + 1, scroll: h > 0 ? clamp01((scrollTop - layout.tops[i]) / h) : 0 };
}

/** Scroll offset that puts `position` at the top of the viewport. */
export function scrollTopFor(layout: Layout, position: Position): number {
  const count = layout.tops.length;
  if (!count) return 0;
  const i = Math.min(count, Math.max(1, Math.floor(position.page))) - 1;
  return Math.round(layout.tops[i] + clamp01(position.scroll) * layout.heights[i]);
}

/** Inclusive 0-based index range of pages intersecting the viewport plus `overscan` px. */
export function visibleRange(
  layout: Layout,
  scrollTop: number,
  viewportHeight: number,
  overscan: number,
): [number, number] {
  if (!layout.tops.length) return [0, -1];
  const first = indexAt(layout, scrollTop - overscan);
  const last = indexAt(layout, scrollTop + viewportHeight + overscan);
  return [first, last];
}

export function samePosition(a: Position | null, b: Position | null): boolean {
  if (!a || !b) return a === b;
  return a.page === b.page && Math.abs(a.scroll - b.scroll) < 0.001;
}
