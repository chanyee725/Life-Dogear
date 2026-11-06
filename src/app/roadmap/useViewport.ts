"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

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

// ---------------------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------------------

export interface ViewportOptions {
  /** Starting zoom (clamped). Default 1. */
  initialZoom?: number;
  /**
   * Box to bring into view once the container mounts (layout px, e.g. the root node's
   * x/y/width/height from layoutTree). Applied a single time, the first render it is set.
   */
  initialFocus?: Rect | null;
}

export interface Viewport {
  /** Callback ref for the scroll container (needs `overflow: auto`). */
  ref: (el: HTMLDivElement | null) => void;
  /** Current zoom, 0.5..2. Scale the content by this (size × zoom, or transform). */
  zoom: number;
  /** True while the user is dragging: show a grabbing cursor, disable text selection. */
  dragging: boolean;
  /** Set the zoom, keeping `anchor` (viewport px; default: viewport centre) fixed. */
  setZoom: (zoom: number, anchor?: Point) => void;
  /** Scroll so `rect` (layout px) sits at the left margin, vertically centred. */
  focus: (rect: Rect) => void;
}

/** Elements where a press means typing/selecting, not panning. */
const isEditable = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement &&
  (t.isContentEditable || t.closest("input, textarea, select, [contenteditable='true']") !== null);

/**
 * Pannable, zoomable scroll container for the roadmap tree.
 *
 * - Drag with the primary mouse button to pan. A press that moves less than
 *   DRAG_THRESHOLD px stays a click; after a real drag the click that follows is swallowed,
 *   so letting go over a node does not open it.
 * - Ctrl+wheel (and trackpad pinch) zooms 0.5..2× around the cursor; plain wheel scrolls.
 * - `initialFocus` scrolls the root into view on first mount.
 */
export function useViewport({
  initialZoom = 1,
  initialFocus = null,
}: ViewportOptions = {}): Viewport {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [zoom, setZoomState] = useState(() => clampZoom(initialZoom));
  const [dragging, setDragging] = useState(false);

  // Latest zoom and the scroll still waiting for the zoomed content to render: wheel events
  // can arrive faster than React re-renders, and each must build on the previous one.
  const zoomRef = useRef(zoom);
  const pendingScroll = useRef<Scroll | null>(null);
  const focused = useRef(false);

  const setZoom = useCallback(
    (next: number, anchor?: Point) => {
      const from = zoomRef.current;
      const to = clampZoom(next);
      if (!el || to === from) return;
      const at = anchor ?? { x: el.clientWidth / 2, y: el.clientHeight / 2 };
      const current = pendingScroll.current ?? { left: el.scrollLeft, top: el.scrollTop };
      pendingScroll.current = zoomScroll(current, from, to, at);
      zoomRef.current = to;
      setZoomState(to);
    },
    [el],
  );

  // Apply the anchored scroll after the content has been resized for the new zoom.
  useLayoutEffect(() => {
    const target = pendingScroll.current;
    if (!el || !target) return;
    pendingScroll.current = null;
    el.scrollLeft = target.left;
    el.scrollTop = target.top;
  }, [el, zoom]);

  const focus = useCallback(
    (rect: Rect) => {
      if (!el) return;
      const s = focusScroll(
        rect,
        zoomRef.current,
        { width: el.clientWidth, height: el.clientHeight },
        { width: el.scrollWidth, height: el.scrollHeight },
      );
      el.scrollLeft = s.left;
      el.scrollTop = s.top;
    },
    [el],
  );

  useLayoutEffect(() => {
    if (!el || !initialFocus || focused.current) return;
    focused.current = true;
    focus(initialFocus);
  }, [el, initialFocus, focus]);

  // Ctrl+wheel zoom. Native, non-passive listener so preventDefault stops the page zoom.
  useEffect(() => {
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      // deltaMode 1 = lines (Firefox mouse wheels); treat a line as ~16px.
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const box = el.getBoundingClientRect();
      setZoom(wheelZoom(zoomRef.current, dy), {
        x: e.clientX - box.left - el.clientLeft,
        y: e.clientY - box.top - el.clientTop,
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [el, setZoom]);

  // Drag to pan.
  useEffect(() => {
    if (!el) return;
    let press: { id: number; x: number; y: number; left: number; top: number } | null = null;
    let moved = false;
    let swallowClick = false;
    let clearSwallow: ReturnType<typeof setTimeout> | undefined;

    const end = (e: PointerEvent) => {
      if (!press || e.pointerId !== press.id) return;
      press = null;
      if (moved) {
        moved = false;
        setDragging(false);
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        if (e.type === "pointerup") {
          // The click (if any) fires right after pointerup; drop the flag after that so a
          // later keyboard "click" is not eaten when no pointer click arrived.
          swallowClick = true;
          clearSwallow = setTimeout(() => (swallowClick = false), 0);
        }
      }
    };

    const onDown = (e: PointerEvent) => {
      swallowClick = false;
      if (e.button !== 0 || e.pointerType === "touch" || isEditable(e.target)) return;
      press = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        left: el.scrollLeft,
        top: el.scrollTop,
      };
      moved = false;
    };

    const onMove = (e: PointerEvent) => {
      if (!press || e.pointerId !== press.id) return;
      const dx = e.clientX - press.x;
      const dy = e.clientY - press.y;
      if (!moved) {
        if (!isDrag(dx, dy)) return;
        moved = true;
        setDragging(true);
        el.setPointerCapture(e.pointerId);
        window.getSelection()?.removeAllRanges();
      }
      e.preventDefault();
      el.scrollLeft = press.left - dx;
      el.scrollTop = press.top - dy;
    };

    const onClick = (e: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.preventDefault();
      e.stopPropagation();
    };

    // Links and images start a native HTML drag, which cancels the pointer stream.
    const onDragStart = (e: DragEvent) => {
      if (press) e.preventDefault();
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("click", onClick, true);
    el.addEventListener("dragstart", onDragStart);
    return () => {
      clearTimeout(clearSwallow);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", end);
      el.removeEventListener("pointercancel", end);
      el.removeEventListener("click", onClick, true);
      el.removeEventListener("dragstart", onDragStart);
    };
  }, [el]);

  return { ref: setEl, zoom, dragging, setZoom, focus };
}
