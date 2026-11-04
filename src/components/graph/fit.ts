/** Helpers for fitting the graph after a filter change (pure; see GraphCanvas). */

export type Box = { x: [number, number]; y: [number, number] };

/** Ticks after new data before the early fit (about 1/3 s at 60 fps). */
export const EARLY_FIT_TICKS = 20;

/** Refit when the simulation stops only if the graph grew more than this since the early fit. */
export const REFIT_GROWTH = 0.15;

/** True when `next` is wider or taller than `prev` by more than `ratio`. */
export function grewBeyond(prev: Box, next: Box, ratio = REFIT_GROWTH): boolean {
  const w = (b: Box) => Math.max(b.x[1] - b.x[0], 1);
  const h = (b: Box) => Math.max(b.y[1] - b.y[0], 1);
  return w(next) > w(prev) * (1 + ratio) || h(next) > h(prev) * (1 + ratio);
}

type Pos = { x?: number; y?: number };

/**
 * Starting point for a node that just appeared (e.g. tasks switched on): next to the first
 * linked node that already has a position, so it doesn't start at the origin and fly across.
 * Null when no neighbour is placed yet.
 */
export function seedNear(
  id: string,
  links: readonly { source: string; target: string }[],
  placed: ReadonlyMap<string, Pos>,
  jitter: () => number = Math.random,
): { x: number; y: number } | null {
  for (const l of links) {
    const other = l.source === id ? l.target : l.target === id ? l.source : null;
    if (!other) continue;
    const p = placed.get(other);
    if (p?.x == null || p.y == null) continue;
    const angle = jitter() * Math.PI * 2;
    return { x: p.x + Math.cos(angle) * 30, y: p.y + Math.sin(angle) * 30 };
  }
  return null;
}

// ---------- Fit the whole drawing (nodes and their labels) ----------

/**
 * One node for fitting: centre and shape extents in graph units, plus the label hanging
 * below it in screen px (labels are drawn at a constant screen size, so they do not scale).
 */
export type FitItem = {
  x: number;
  y: number;
  /** Shape half-width and extents above/below the centre (graph units). */
  side: number;
  top: number;
  bottom: number;
  /** Label width and height in screen px, drawn centred under the shape. 0 = no label. */
  labelW: number;
  labelH: number;
};

export type FitArea = {
  width: number;
  height: number;
  /** Overlays covering the left/right edge (screen px). */
  left?: number;
  right?: number;
  /** Margin kept free on every side (screen px). */
  pad: number;
  minZoom: number;
  maxZoom: number;
};

type Extent = { x0: number; x1: number; y0: number; y1: number };

/** Screen-px extents of everything drawn at zoom `k`, relative to the graph origin. */
export function screenExtent(items: readonly FitItem[], k: number): Extent | null {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const n of items) {
    const half = Math.max(n.side * k, n.labelW / 2);
    x0 = Math.min(x0, n.x * k - half);
    x1 = Math.max(x1, n.x * k + half);
    y0 = Math.min(y0, (n.y - n.top) * k);
    y1 = Math.max(y1, (n.y + n.bottom) * k + n.labelH);
  }
  return x0 === Infinity ? null : { x0, x1, y0, y1 };
}

/**
 * Zoom and centre that fit every node *and its label* inside the free area. Labels keep
 * their screen size, so the zoom is found by bisection (the drawing's screen span only
 * grows with the zoom). Falls back to `minZoom` when nothing smaller fits.
 */
export function fitTransform(
  items: readonly FitItem[],
  area: FitArea,
): { k: number; cx: number; cy: number } | null {
  if (items.length === 0) return null;
  const left = area.left ?? 0;
  const right = area.right ?? 0;
  const availW = Math.max(area.width - left - right - area.pad * 2, 1);
  const availH = Math.max(area.height - area.pad * 2, 1);
  const fits = (k: number) => {
    const e = screenExtent(items, k)!;
    return e.x1 - e.x0 <= availW && e.y1 - e.y0 <= availH;
  };
  let k: number;
  if (fits(area.maxZoom)) k = area.maxZoom;
  else if (!fits(area.minZoom)) k = area.minZoom;
  else {
    let lo = area.minZoom;
    let hi = area.maxZoom;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) lo = mid;
      else hi = mid;
    }
    k = lo;
  }
  const e = screenExtent(items, k)!;
  // Centre the drawing in the free area: shift by (left − right) / 2 px.
  return {
    k,
    cx: ((e.x0 + e.x1) / 2 - (left - right) / 2) / k,
    cy: (e.y0 + e.y1) / 2 / k,
  };
}

/**
 * True when part of the drawing at zoom `k`, centred on graph point (cx, cy), lies outside
 * the free area — e.g. the layout drifted after the early fit without growing.
 */
export function overflowsArea(
  items: readonly FitItem[],
  view: { k: number; cx: number; cy: number },
  area: Pick<FitArea, "width" | "height" | "left" | "right">,
): boolean {
  const e = screenExtent(items, view.k);
  if (!e) return false;
  // Screen x of graph point gx is (gx − cx)·k + width / 2.
  const ox = area.width / 2 - view.cx * view.k;
  const oy = area.height / 2 - view.cy * view.k;
  return (
    e.x0 + ox < (area.left ?? 0) - 0.5 ||
    e.x1 + ox > area.width - (area.right ?? 0) + 0.5 ||
    e.y0 + oy < -0.5 ||
    e.y1 + oy > area.height + 0.5
  );
}

// ---------- When to refit on settle ----------

/**
 * Whether the next engine stop may refit because the drawing drifted off screen. Armed by
 * an automatic fit (first entry, filter change); disarmed by the first stop after it and by
 * the user zooming, panning or dragging — so a later stop never snaps their view back.
 * Zoom events before `programmaticUntil` (ms) come from the fit's own animation.
 */
export type RefitGuard = { armed: boolean; programmaticUntil: number };

export const DISARMED: RefitGuard = { armed: false, programmaticUntil: 0 };

/** After an automatic fit at `now` animating for `duration` ms. */
export function armRefit(now: number, duration: number): RefitGuard {
  return { armed: true, programmaticUntil: now + duration + 50 };
}

/** A zoom/pan event at `now`: the user's own once the fit's animation is over. */
export function noteTransform(g: RefitGuard, now: number): RefitGuard {
  return g.armed && now > g.programmaticUntil ? DISARMED : g;
}

/** At an engine stop: refit only when armed and off screen; either way, disarm. */
export function refitOnStop(
  g: RefitGuard,
  offScreen: () => boolean,
): { refit: boolean; next: RefitGuard } {
  return { refit: g.armed && offScreen(), next: DISARMED };
}
