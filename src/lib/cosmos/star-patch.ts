/**
 * Client-side update after a star toggle: re-score one node from the parts the API
 * already sent and rebuild the side-panel lists, keeping the same nodes/edges arrays so
 * the cosmos layout does not restart. Pure.
 */
import type { GraphNodeId } from "@/lib/graph/types";
import { lonelyStars, neglectedImportant, rescore, topImportant } from "./score";
import type { CosmosResponse } from "./types";

/** `data` with `id` starred or not; null when the node is not in `data`. */
export function withStar(
  data: CosmosResponse,
  id: GraphNodeId,
  starred: boolean,
  now: Date,
): CosmosResponse | null {
  const node = data.nodes.find((n) => n.id === id);
  const current = data.cosmos[id];
  if (!node || !current) return null;

  const cosmos: CosmosResponse["cosmos"] = {
    ...data.cosmos,
    [id]: { ...current, starred, score: rescore(current, starred, node.archived) },
  };

  const pairs = new Set<string>();
  const degree = new Map<GraphNodeId, number>();
  for (const e of data.edges) {
    if (e.source === e.target) continue;
    const key = e.source < e.target ? `${e.source}|${e.target}` : `${e.target}|${e.source}`;
    if (pairs.has(key)) continue;
    pairs.add(key);
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }

  const scored = data.nodes.map((n) => {
    const info = cosmos[n.id];
    return {
      id: n.id,
      type: n.type,
      horizon: n.horizon,
      degree: degree.get(n.id) ?? 0,
      lastActiveAt: info?.lastActiveAt ?? null,
      direct: info?.direct ?? 0,
      centrality: info?.centrality ?? 0,
      recency: info?.recency ?? 0,
      starred: info?.starred ?? false,
      score: info?.score ?? 0,
    };
  });

  return {
    ...data,
    cosmos,
    top: topImportant(scored).map((x) => x.id),
    lonely: lonelyStars(scored).map((x) => x.id),
    neglected: neglectedImportant(scored, now).map((x) => x.id),
  };
}
