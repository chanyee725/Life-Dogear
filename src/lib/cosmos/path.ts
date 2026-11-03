/**
 * "왜 중요한가" path for the cosmos view (docs/PLAN-COSMOS.md 2절): from a node up to a
 * life goal — item → project → quarter → year → life goal — drawn as a constellation.
 * Pure, BFS over a fixed graph: O(n + e).
 *
 * Allowed steps (so the path always climbs toward goals):
 * - `belongs` edges, child → parent (source → target);
 * - from a paper / seminar / thought / review / tag, one `link`/`body`/`topic` hop to a
 *   project or a goal (how notes attach to the structure).
 */
import type { GraphEdge, GraphNode, GraphNodeId, GraphNodeType } from "@/lib/graph/types";

const NOTE_TYPES: ReadonlySet<GraphNodeType> = new Set([
  "paper",
  "seminar",
  "thought",
  "review",
  "tag",
]);
const STRUCTURE_TYPES: ReadonlySet<GraphNodeType> = new Set(["project", "goal"]);

const typeOf = (id: GraphNodeId) => id.slice(0, id.indexOf(":")) as GraphNodeType;

/**
 * Shortest path (node ids, start first) from `start` to a life goal, or — when none is
 * reachable — to the highest goal reached (year over quarter), or to a project. Returns
 * `[start]` when nothing above it is reachable.
 */
export function constellationPath(
  start: GraphNodeId,
  nodes: readonly Pick<GraphNode, "id" | "type" | "horizon">[],
  edges: readonly GraphEdge[],
): GraphNodeId[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  if (!byId.has(start)) return [start];

  const up = new Map<GraphNodeId, GraphNodeId[]>();
  const add = (from: GraphNodeId, to: GraphNodeId) => {
    if (!byId.has(from) || !byId.has(to) || from === to) return;
    const list = up.get(from);
    if (list) list.push(to);
    else up.set(from, [to]);
  };
  for (const e of edges) {
    if (e.kind === "belongs") {
      add(e.source, e.target);
      continue;
    }
    // Notes attach to the structure in either direction of the link.
    for (const [a, b] of [
      [e.source, e.target],
      [e.target, e.source],
    ] as const) {
      if (NOTE_TYPES.has(typeOf(a)) && STRUCTURE_TYPES.has(typeOf(b))) add(a, b);
    }
  }
  // Deterministic: visit parents in id order.
  for (const list of up.values()) list.sort();

  const rank = (id: GraphNodeId): number => {
    const n = byId.get(id)!;
    if (n.type === "goal") return n.horizon === "life" ? 3 : n.horizon === "year" ? 2 : 1;
    return n.type === "project" ? 0.5 : 0;
  };

  const prev = new Map<GraphNodeId, GraphNodeId | null>([[start, null]]);
  const queue: GraphNodeId[] = [start];
  let best: GraphNodeId = start;
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]!;
    // BFS order = shortest first; keep the first node of the highest rank.
    if (rank(id) > rank(best)) best = id;
    if (rank(best) === 3) break;
    for (const next of up.get(id) ?? []) {
      if (prev.has(next)) continue;
      prev.set(next, id);
      queue.push(next);
    }
  }

  const path: GraphNodeId[] = [];
  for (let at: GraphNodeId | null = best; at; at = prev.get(at) ?? null) path.push(at);
  return path.reverse();
}
