// Geometry for the roadmap's centre path. The grid ([left items | stage box | right items],
// model.splitSides) places the boxes; this file only answers "where does the thick curve
// between two stages go" and "which items show per stage", as pure functions.
//
// Each gap between stage i and stage i+1 draws its own small inline SVG:
//   <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
//     <path d={stageCurvePath(i, { width: w, height: h })} vector-effect="non-scaling-stroke" />
//   </svg>
// and the stage box itself shifts sideways by `stageSway(i)` px (e.g. a CSS var), so the
// curve's ends meet the box centres.

import type { CollapsedSet } from "./collapse";
import { splitSides, type RoadmapNode } from "./model";

export interface CurveOptions {
  /** SVG user-space width; the curve is centred on width / 2. */
  width: number;
  /** SVG user-space height (the vertical gap between the two stage boxes). */
  height: number;
  /** Max sideways shift of a stage from the centre line, px. Default SWAY. */
  amplitude?: number;
}

/** Default sideways swing of stage boxes, px. */
export const SWAY = 48;

/** Sway pattern per stage index: centre, right, centre, left, ... (a gentle S-curve). */
const PATTERN = [0, 1, 0, -1] as const;

/** Horizontal offset (px, + is right) of stage `index` from the centre line. */
export function stageSway(index: number, amplitude: number = SWAY): number {
  if (index < 0) return 0;
  return PATTERN[index % PATTERN.length] * amplitude;
}

/**
 * Thick centre curve from the bottom centre of stage `index` to the top centre of stage
 * `index + 1`, as an SVG path `d` in a `width × height` box. Cubic Bézier with vertical
 * tangents at both ends so it leaves and enters the boxes straight.
 */
export function stageCurvePath(index: number, opts: CurveOptions): string {
  const { width, height, amplitude = SWAY } = opts;
  const cx = width / 2;
  const x1 = round(cx + stageSway(index, amplitude));
  const x2 = round(cx + stageSway(index + 1, amplitude));
  const h = round(height);
  const mid = round(height / 2);
  return `M ${x1} 0 C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${h}`;
}

export type Side = "left" | "right";

/**
 * Dotted link from a stage box edge to one item, in a `width × height` box spanning the
 * gap between the stage column and the item column on `side`. `fromY` is the stage box's
 * vertical centre, `toY` the item's, both in that box's coordinates.
 */
export function itemLinkPath(side: Side, width: number, fromY: number, toY: number): string {
  const [x1, x2] = side === "left" ? [round(width), 0] : [0, round(width)];
  const mid = round(width / 2);
  return `M ${x1} ${round(fromY)} C ${mid} ${round(fromY)}, ${mid} ${round(toY)}, ${x2} ${round(toY)}`;
}

/** One stage row of the grid: the stage plus its top-level items split for the two sides. */
export interface StageRow {
  stage: RoadmapNode;
  index: number;
  /** True when the stage has items and is folded (left/right are then empty). */
  folded: boolean;
  left: RoadmapNode[];
  right: RoadmapNode[];
  /** Px offset for the stage box (stageSway). */
  sway: number;
  /** True for every stage but the last: draw a curve below it. */
  hasNext: boolean;
}

/**
 * Grid rows for all stages. O(stages + top-level items); folded stages skip their items and
 * nothing below the top level is walked (deeper levels render via the item's own subtree).
 * Memoised on (stages, collapsed, amplitude) identity, so re-renders that keep both
 * references are free; a fold toggle yields a new collapsed set and recomputes once.
 */
export function stageRows(
  stages: RoadmapNode[],
  collapsed: CollapsedSet,
  amplitude: number = SWAY,
): StageRow[] {
  const hit = cache.get(stages);
  if (hit && hit.collapsed === collapsed && hit.amplitude === amplitude) return hit.rows;
  const rows = stages.map((stage, index): StageRow => {
    const folded = stage.children.length > 0 && collapsed.has(stage.id);
    const { left, right } = folded ? { left: [], right: [] } : splitSides(stage.children);
    return {
      stage,
      index,
      folded,
      left,
      right,
      sway: stageSway(index, amplitude),
      hasNext: index < stages.length - 1,
    };
  });
  cache.set(stages, { collapsed, amplitude, rows });
  return rows;
}

const cache = new WeakMap<
  RoadmapNode[],
  { collapsed: CollapsedSet; amplitude: number; rows: StageRow[] }
>();

const round = (n: number) => Math.round(n * 10) / 10;
