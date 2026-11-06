"use client";

// ---------------------------------------------------------------------------------------
// Pure math (unit-tested). Coordinates: "layout px" are the tree's own units (zoom 1);
// "screen px" are layout px × zoom, the units of scrollLeft/scrollTop.
// ---------------------------------------------------------------------------------------

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2;
/** A press that moves fewer px than this is a click, not a drag. */
export const DRAG_THRESHOLD = 4;
/** Room left of the root box when it is first shown, in screen px. */
export const FOCUS_MARGIN = 24;

export interface Point {
  x: number;
  y: number;
}

export interface Scroll {
  left: number;
  top: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Point, Size {}

export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

export const clampZoom = (z: number): number => clamp(z, MIN_ZOOM, MAX_ZOOM);

/** True once a press has moved far enough (either axis, Euclidean) to count as a drag. */
export const isDrag = (dx: number, dy: number, threshold = DRAG_THRESHOLD): boolean =>
  Math.hypot(dx, dy) >= threshold;

/**
 * Zoom after one Ctrl+wheel tick. Exponential, so a notch in then a notch out lands back
 * where it started; small trackpad-pinch deltas give small steps. Wheel up (deltaY < 0)
 * zooms in. Result is clamped to [MIN_ZOOM, MAX_ZOOM].
 */
export function wheelZoom(zoom: number, deltaY: number): number {
  return clampZoom(zoom * Math.exp(-deltaY * 0.002));
}

/** Largest valid scroll offset on one axis (never negative). */
export const maxScroll = (content: number, viewport: number): number =>
  Math.max(0, content - viewport);

/** Clamp a scroll position into the scrollable range of `content` inside `viewport`. */
export function clampScroll(scroll: Scroll, content: Size, viewport: Size): Scroll {
  return {
    left: clamp(scroll.left, 0, maxScroll(content.width, viewport.width)),
    top: clamp(scroll.top, 0, maxScroll(content.height, viewport.height)),
  };
}

/**
 * Scroll that keeps the layout point under `anchor` (a point in the viewport, relative to
 * its top-left) fixed while the zoom goes from `from` to `to`. Not clamped: the browser
 * clamps when it is applied, after the content has resized.
 */
export function zoomScroll(scroll: Scroll, from: number, to: number, anchor: Point): Scroll {
  const ratio = to / from;
  return {
    left: (scroll.left + anchor.x) * ratio - anchor.x,
    top: (scroll.top + anchor.y) * ratio - anchor.y,
  };
}

/**
 * Scroll that shows `rect` (layout px): its left edge FOCUS_MARGIN px from the viewport's
 * left, vertically centred. `content` is the scaled content size; the result is clamped.
 */
export function focusScroll(
  rect: Rect,
  zoom: number,
  viewport: Size,
  content: Size,
  margin = FOCUS_MARGIN,
): Scroll {
  return clampScroll(
    {
      left: rect.x * zoom - margin,
      top: (rect.y + rect.height / 2) * zoom - viewport.height / 2,
    },
    content,
    viewport,
  );
}
