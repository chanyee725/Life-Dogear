/**
 * Galaxy (area cluster) per node for the cosmos view (docs/PLAN-COSMOS.md C3): each area
 * is one galaxy; items without an area are neutral (null); life goals are the "sun" at
 * the centre (null too, drawn specially). Pure, one pass: O(n + e).
 *
 * 1. an area is its own galaxy;
 * 2. a node with `areaId` (projects, goals) belongs to that area;
 * 3. other nodes take the most common galaxy among their neighbours from steps 1–2, so
 *    papers follow their projects; a tie stays neutral (no single galaxy wins);
 * 4. reviews and topics are always neutral (docs/design/cosmos.md 1.1).
 */
import type { GraphEdge, GraphNode, GraphNodeId } from "@/lib/graph/types";

export function assignGalaxies(
  nodes: readonly Pick<GraphNode, "id" | "type" | "areaId" | "horizon">[],
  edges: readonly Pick<GraphEdge, "source" | "target">[],
  /** Every existing area id (so `areaId` counts even when area nodes are filtered out). */
  knownAreas?: Iterable<string>,
): Map<GraphNodeId, string | null> {
  const areaIds = new Set(knownAreas ?? []);
  for (const n of nodes) if (n.type === "area") areaIds.add(n.id.slice(5));
  const direct = new Map<GraphNodeId, string>();
  for (const n of nodes) {
    if (n.type === "goal" && n.horizon === "life") continue;
    if (n.type === "area") direct.set(n.id, n.id.slice(5));
    else if (n.areaId && areaIds.has(n.areaId)) direct.set(n.id, n.areaId);
  }

  const votes = new Map<GraphNodeId, Map<string, number>>();
  const vote = (to: GraphNodeId, from: GraphNodeId) => {
    const g = direct.get(from);
    if (!g || direct.has(to)) return;
    let m = votes.get(to);
    if (!m) votes.set(to, (m = new Map()));
    m.set(g, (m.get(g) ?? 0) + 1);
  };
  for (const e of edges) {
    vote(e.source, e.target);
    vote(e.target, e.source);
  }

  const out = new Map<GraphNodeId, string | null>();
  for (const n of nodes) {
    if ((n.type === "goal" && n.horizon === "life") || n.type === "review" || n.type === "tag") {
      out.set(n.id, null);
      continue;
    }
    const own = direct.get(n.id);
    if (own) {
      out.set(n.id, own);
      continue;
    }
    let best: string | null = null;
    let bestCount = 0;
    let tied = false;
    for (const [g, c] of votes.get(n.id) ?? []) {
      if (c > bestCount) {
        best = g;
        bestCount = c;
        tied = false;
      } else if (c === bestCount) {
        tied = true;
      }
    }
    out.set(n.id, tied ? null : best);
  }
  return out;
}
