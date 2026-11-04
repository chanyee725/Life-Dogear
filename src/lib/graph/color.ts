/**
 * Node color assignment for the basic graph (docs/design/graph.md 1절). Pure, no DOM.
 *
 * Two bases, switched by the "색 기준" toggle:
 * - `kind`: each kind has its own color (the theme maps kind → color);
 * - `area`: the cosmos view's galaxy rule (`assignGalaxies`): an area and the items that
 *   name it get the area's color, other items the most common area among their
 *   neighbours, ties and reviews/topics stay neutral. One difference (design 1.3): a
 *   life goal with an area takes that area's color like any goal (the cosmos view draws
 *   life goals as suns); a life goal without one stays neutral.
 *
 * Area colors are palette slots, not ids: the i-th area actually used, in sidebar order
 * (`areaOrder`), takes slot i — the same numbering as the cosmos view, so an area has the
 * same hue in both modes for the same filter.
 */
import { assignGalaxies } from "@/lib/cosmos/galaxy";
import type { GraphEdge, GraphNode, GraphNodeId } from "./types";

export const GRAPH_COLOR_BYS = ["kind", "area"] as const;
export type GraphColorBy = (typeof GRAPH_COLOR_BYS)[number];
export const DEFAULT_GRAPH_COLOR_BY: GraphColorBy = "kind";
export const GRAPH_COLOR_BY_STORAGE_KEY = "rb-graph-color-by";

export function isGraphColorBy(value: unknown): value is GraphColorBy {
  return typeof value === "string" && (GRAPH_COLOR_BYS as readonly string[]).includes(value);
}

export type AreaSlots = {
  /** Node id → palette slot, or null for neutral. */
  slot: Map<GraphNodeId, number | null>;
  /** Areas in slot order (slot = index). */
  areas: string[];
};

/**
 * Area palette slot per node. `areaOrder` lists every area id in sidebar order (areas that
 * only appear as nodes are appended in node order).
 */
export function assignAreaSlots(
  nodes: readonly Pick<GraphNode, "id" | "type" | "areaId" | "horizon">[],
  edges: readonly Pick<GraphEdge, "source" | "target">[],
  areaOrder: readonly string[] = [],
): AreaSlots {
  // assignGalaxies always leaves life goals out; here one with an area counts like a year goal.
  const input = nodes.map((n) =>
    n.type === "goal" && n.horizon === "life" && n.areaId ? { ...n, horizon: "year" as const } : n,
  );
  const galaxies = assignGalaxies(input, edges, areaOrder);
  const used = new Set<string>();
  for (const g of galaxies.values()) if (g !== null) used.add(g);

  const areas = areaOrder.filter((a) => used.has(a));
  const listed = new Set(areas);
  for (const n of nodes) {
    const g = galaxies.get(n.id);
    if (g != null && !listed.has(g)) {
      listed.add(g);
      areas.push(g);
    }
  }
  const index = new Map(areas.map((a, i) => [a, i] as const));
  const slot = new Map<GraphNodeId, number | null>();
  for (const [id, g] of galaxies) slot.set(id, g === null ? null : index.get(g)!);
  return { slot, areas };
}

/** Palette color of a slot (wraps around); `neutral` when the slot is null. */
export function slotColor(
  slot: number | null | undefined,
  palette: readonly string[],
  neutral: string,
): string {
  if (slot == null || palette.length === 0) return neutral;
  return palette[slot % palette.length]!;
}
