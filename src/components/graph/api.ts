/**
 * Client calls to the graph API (`/api/graph/**`, `/graph/preview`).
 * `?mock=<n>` on the page URL swaps in an n-node mock to check performance.
 */
import type {
  GraphFilter,
  GraphLayoutBody,
  GraphNodeId,
  GraphPosition,
  GraphResponse,
  LocalGraphData,
} from "@/lib/graph/types";
import { mockGraph, type MockGraph } from "./mock";
import { drawableEdges, graphQuery, localSubgraph, shownTypes } from "./model";
import type { NodePreview } from "./preview-types";

export type GraphLoad = GraphResponse & { mock: boolean };

let mockCache: { total: number; graph: MockGraph } | null = null;
function mock(total: number): MockGraph {
  if (!mockCache || mockCache.total !== total) mockCache = { total, graph: mockGraph(total) };
  return mockCache.graph;
}

function forcedMockSize(): number | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("mock");
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 20000) : null;
}

export async function fetchGraph(filter: GraphFilter, signal?: AbortSignal): Promise<GraphLoad> {
  const forced = forcedMockSize();
  if (forced) {
    const g = mock(forced);
    const types = new Set(shownTypes(filter));
    const nodes = g.nodes.filter((n) => types.has(n.type) && (filter.archived || !n.archived));
    return { nodes, edges: drawableEdges(nodes, g.edges), positions: [], mock: true };
  }
  const res = await fetch(`/api/graph${graphQuery(filter)}`, { signal, cache: "no-store" });
  if (!res.ok) throw new Error(`graph ${res.status}`);
  const body = (await res.json()) as Partial<GraphResponse>;
  return {
    nodes: body.nodes ?? [],
    edges: body.edges ?? [],
    positions: body.positions ?? [],
    mock: false,
  };
}

/** Local graph around `node`; null when the node does not exist (404). */
export async function fetchLocalGraph(
  node: GraphNodeId,
  depth: 1 | 2,
  signal?: AbortSignal,
): Promise<LocalGraphData | null> {
  const forced = forcedMockSize();
  if (forced) return { ...localSubgraph(mock(forced), node, depth), truncated: false };
  const q = new URLSearchParams({ node, depth: String(depth) });
  const res = await fetch(`/api/graph/local?${q}`, { signal, cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`local graph ${res.status}`);
  const body = (await res.json()) as Partial<LocalGraphData>;
  return { nodes: body.nodes ?? [], edges: body.edges ?? [], truncated: !!body.truncated };
}

export async function fetchPreview(
  node: GraphNodeId,
  signal?: AbortSignal,
): Promise<NodePreview | null> {
  if (forcedMockSize()) return null;
  const res = await fetch(`/graph/preview?${new URLSearchParams({ node })}`, {
    signal,
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as NodePreview;
}

export async function saveLayout(positions: GraphPosition[], mockMode: boolean): Promise<void> {
  if (mockMode || positions.length === 0) return;
  const body: GraphLayoutBody = { positions };
  const res = await fetch("/api/graph/layout", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`layout ${res.status}`);
}

export async function resetLayout(mockMode: boolean): Promise<void> {
  if (mockMode) return;
  const res = await fetch("/api/graph/layout", { method: "DELETE" });
  if (!res.ok) throw new Error(`layout ${res.status}`);
}
