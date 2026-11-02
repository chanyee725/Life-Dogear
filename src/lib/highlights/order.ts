import type { RatioRect } from "./rects";

type Ordered = { page: number; rects: RatioRect[]; createdAt: string };

const topOf = (h: Ordered) => (h.rects.length ? Math.min(...h.rects.map((r) => r.y)) : 0);

/** Reading order: page, then position on the page, then creation time. */
export function compareHighlights(a: Ordered, b: Ordered): number {
  return a.page - b.page || topOf(a) - topOf(b) || a.createdAt.localeCompare(b.createdAt);
}

export function sortHighlights<T extends Ordered>(list: T[]): T[] {
  return [...list].sort(compareHighlights);
}
