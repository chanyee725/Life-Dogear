/**
 * Highlight rectangles are stored as fractions (0–1) of the page's width and
 * height, so they line up at any zoom level or viewer width.
 */
export type RatioRect = { x: number; y: number; w: number; h: number };

/** Minimal shape of `DOMRect` / `DOMRectReadOnly`, so this stays testable without a DOM. */
export type BoxLike = { left: number; top: number; width: number; height: number };

export const MAX_RECTS = 500;
const PRECISION = 10_000;
const EPSILON = 1e-6;

const round = (n: number) => Math.round(n * PRECISION) / PRECISION;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Converts client rects (e.g. `Range.getClientRects()`) to page fractions.
 * Rects are clipped to the page; empty, off-page and page-sized rects are dropped;
 * rects on the same text line are merged.
 */
export function toPageRatios(rects: Iterable<BoxLike>, page: BoxLike): RatioRect[] {
  if (!(page.width > 0) || !(page.height > 0)) return [];
  const out: RatioRect[] = [];
  for (const r of rects) {
    const x1 = clamp01((r.left - page.left) / page.width);
    const y1 = clamp01((r.top - page.top) / page.height);
    const x2 = clamp01((r.left + r.width - page.left) / page.width);
    const y2 = clamp01((r.top + r.height - page.top) / page.height);
    if (x2 - x1 <= EPSILON || y2 - y1 <= EPSILON) continue;
    const rect = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    if (isPageSized(rect)) continue;
    out.push(rect);
  }
  return mergeLineRects(out).map((r) => ({
    x: round(r.x),
    y: round(r.y),
    w: round(r.w),
    h: round(r.h),
  }));
}

/** Share of the page area at or above which a rect is a filler, not text. */
export const PAGE_SIZED_AREA = 0.9;
/** A text line never reaches half the page height. */
export const MAX_LINE_HEIGHT = 0.5;

/**
 * Rects covering (nearly) the whole page or taller than any text line — e.g. the
 * pdf.js text layer's `endOfContent` filler after Ctrl+A or a drag past the last
 * line. They would paint the whole page, so they are dropped.
 */
export function isPageSized(r: RatioRect): boolean {
  return r.w * r.h >= PAGE_SIZED_AREA || r.h >= MAX_LINE_HEIGHT;
}

/**
 * Merges rects that sit on the same line (vertical overlap ≥ half the shorter
 * height) and touch or overlap horizontally (gap ≤ one line height). The pdf.js
 * text layer yields one rect per text run, often several per line.
 */
export function mergeLineRects(rects: RatioRect[]): RatioRect[] {
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x);
  const merged: RatioRect[] = [];
  for (const r of sorted) {
    const last = merged.find((m) => sameLine(m, r) && touches(m, r));
    if (!last) {
      merged.push({ ...r });
      continue;
    }
    const x1 = Math.min(last.x, r.x);
    const y1 = Math.min(last.y, r.y);
    const x2 = Math.max(last.x + last.w, r.x + r.w);
    const y2 = Math.max(last.y + last.h, r.y + r.h);
    Object.assign(last, { x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
  }
  return merged.sort((a, b) => a.y - b.y || a.x - b.x);
}

function sameLine(a: RatioRect, b: RatioRect): boolean {
  const overlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return overlap >= Math.min(a.h, b.h) / 2;
}

function touches(a: RatioRect, b: RatioRect): boolean {
  const gap = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w);
  return gap <= Math.max(a.h, b.h);
}

function isRatioRect(v: unknown): v is RatioRect {
  if (typeof v !== "object" || v === null) return false;
  const { x, y, w, h } = v as Record<string, unknown>;
  const nums = [x, y, w, h];
  if (!nums.every((n) => typeof n === "number" && Number.isFinite(n))) return false;
  const [nx, ny, nw, nh] = nums as number[];
  return nx >= 0 && ny >= 0 && nw > 0 && nh > 0 && nx + nw <= 1 + EPSILON && ny + nh <= 1 + EPSILON;
}

/**
 * Validates rects coming from the client: an array (≤ MAX_RECTS) of `{x, y, w, h}`
 * fractions inside the page. Returns the cleaned list (only those four keys,
 * rounded) or null when anything is off.
 */
export function validateRects(value: unknown): RatioRect[] | null {
  if (!Array.isArray(value) || value.length > MAX_RECTS) return null;
  if (!value.every(isRatioRect)) return null;
  return value.map((r) => ({ x: round(r.x), y: round(r.y), w: round(r.w), h: round(r.h) }));
}

/** Reads the stored JSON column; broken or invalid data becomes `[]`. */
export function parseStoredRects(json: string): RatioRect[] {
  try {
    return validateRects(JSON.parse(json)) ?? [];
  } catch {
    return [];
  }
}

/** Where to scroll for a highlight: a little above its first rect (0–1 within the page). */
export function scrollTargetFor(rects: RatioRect[]): number {
  if (!rects.length) return 0;
  const top = Math.min(...rects.map((r) => r.y));
  return Math.max(0, round(top - 0.05));
}
