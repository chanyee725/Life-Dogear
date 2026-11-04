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
