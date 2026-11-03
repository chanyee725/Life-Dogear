/**
 * "왜 중요한가" constellation — docs/design/cosmos.md 6.2. From the selected node S, climb
 * `belongs` edges only (source = child → target = parent) toward life goals: item →
 * project → quarter → year → life goal. A node with no `belongs` parent (papers,
 * thoughts, …) first steps over `link`/`body` edges to **every** linked project. The
 * highlighted path is the union of all such climbs. Pure, O(n + e).
 */
import type { GraphEdge, GraphNode, GraphNodeId } from "@/lib/graph/types";

export type Constellation = {
  /** P: nodes on the path, S included. */
  nodes: Set<GraphNodeId>;
  /** Path edges as `"source|target"` keys (as given in the edge list). */
  edges: Set<string>;
  /** One shortest chain S → … → its highest goal (for the preview text). */
  chain: GraphNodeId[];
  /** Steps from S to the nearest life goal; null when none is reached. */
  stepsToLife: number | null;
};

export const edgeKey = (e: Pick<GraphEdge, "source" | "target">) => `${e.source}|${e.target}`;

export function constellationPath(
  start: GraphNodeId,
  nodes: readonly Pick<GraphNode, "id" | "type" | "horizon">[],
  edges: readonly GraphEdge[],
): Constellation {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const empty: Constellation = {
    nodes: new Set([start]),
    edges: new Set(),
    chain: [start],
    stepsToLife: null,
  };
  if (!byId.has(start)) return empty;

  // Parent edges per child (belongs only).
  const parents = new Map<GraphNodeId, GraphEdge[]>();
  for (const e of edges) {
    if (e.kind !== "belongs" || !byId.has(e.source) || !byId.has(e.target)) continue;
    if (e.source === e.target) continue;
    const list = parents.get(e.source);
    if (list) list.push(e);
    else parents.set(e.source, [e]);
  }
  for (const list of parents.values()) list.sort((a, b) => (a.target < b.target ? -1 : 1));

  // First step: S's own parents, or — if it has none — every project linked to it.
  let first: { to: GraphNodeId; edge: GraphEdge }[] = (parents.get(start) ?? []).map((e) => ({
    to: e.target,
    edge: e,
  }));
  if (first.length === 0) {
    first = edges
      .filter(
        (e) =>
          (e.kind === "link" || e.kind === "body") && (e.source === start || e.target === start),
      )
      .map((e) => ({ to: e.source === start ? e.target : e.source, edge: e }))
      .filter(({ to }) => byId.get(to)?.type === "project")
      .sort((a, b) => (a.to < b.to ? -1 : 1));
  }
  if (first.length === 0) return empty;

  const pathNodes = new Set<GraphNodeId>([start]);
  const pathEdges = new Set<string>();
  const prev = new Map<GraphNodeId, GraphNodeId | null>([[start, null]]);
  const dist = new Map<GraphNodeId, number>([[start, 0]]);
  const queue: GraphNodeId[] = [];
  for (const { to, edge } of first) {
    pathEdges.add(edgeKey(edge));
    pathNodes.add(to);
    if (!prev.has(to)) {
      prev.set(to, start);
      dist.set(to, 1);
      queue.push(to);
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]!;
    for (const e of parents.get(id) ?? []) {
      pathEdges.add(edgeKey(e));
      pathNodes.add(e.target);
      if (prev.has(e.target)) continue;
      prev.set(e.target, id);
      dist.set(e.target, dist.get(id)! + 1);
      queue.push(e.target);
    }
  }

  // Chain to the highest goal reached (life > year > quarter > project), nearest first.
  const rank = (id: GraphNodeId) => {
    const n = byId.get(id)!;
    if (n.type === "goal") return n.horizon === "life" ? 3 : n.horizon === "year" ? 2 : 1;
    return n.type === "project" ? 0.5 : 0;
  };
  let best: GraphNodeId = start;
  for (const id of queue) {
    if (rank(id) > rank(best) || (rank(id) === rank(best) && dist.get(id)! < dist.get(best)!)) {
      best = id;
    }
  }
  const chain: GraphNodeId[] = [];
  for (let at: GraphNodeId | null = best; at; at = prev.get(at) ?? null) chain.push(at);
  chain.reverse();

  return {
    nodes: pathNodes,
    edges: pathEdges,
    chain,
    stepsToLife: rank(best) === 3 ? dist.get(best)! : null,
  };
}
