/**
 * Deterministic mock graph with the `/api/graph` shape, for checking the screen with many
 * nodes (`/graph?mock=3000`). Not used otherwise; all titles are made up.
 */
import type {
  GraphData,
  GraphEdge,
  GraphNode,
  GraphNodeId,
  GraphNodeType,
} from "@/lib/graph/types";
import { degrees, drawableEdges } from "./model";

export type MockGraph = GraphData & { tags: Map<GraphNodeId, string[]> };

function withDegrees(data: GraphData): GraphData {
  const edges = drawableEdges(data.nodes, data.edges);
  const deg = degrees(edges);
  return { nodes: data.nodes.map((n) => ({ ...n, size: deg.get(n.id) ?? 0 })), edges };
}

/** Small seeded PRNG (mulberry32) so the mock is stable between renders. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAGS = ["방법론", "통계", "인터뷰", "설계", "글쓰기", "학회"];

/** Builds a mock graph of roughly `total` nodes (min 40). */
export function mockGraph(total = 120, seed = 7): MockGraph {
  const rand = rng(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const tags = new Map<GraphNodeId, string[]>();
  const make = (type: GraphNodeType, i: number, title: string, extra: Partial<GraphNode> = {}) => {
    const node: GraphNode = {
      id: `${type}:m${i}` as GraphNodeId,
      type,
      title,
      size: 0,
      archived: false,
      ...extra,
    };
    nodes.push(node);
    return node;
  };

  const scale = Math.max(1, Math.round(total / 120));
  const areas = Array.from({ length: 3 + scale }, (_, i) =>
    make("area", i, `영역 ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? i : ""}`),
  );
  const life = [
    make("goal", 0, "좋은 연구자가 된다", { horizon: "life" as const }),
    make("goal", 1, "건강하게 산다", { horizon: "life" as const }),
  ];
  const years = Array.from({ length: 2 + scale }, (_, i) => {
    const g = make("goal", 10 + i, `연 목표 ${i + 1}`, {
      horizon: "year" as const,
      period: "2027",
      areaId: pick(areas).id.slice(5),
    });
    edges.push({ source: g.id, target: pick(life).id, kind: "belongs" });
    return g;
  });
  const quarters = Array.from({ length: 3 + scale * 2 }, (_, i) => {
    const g = make("goal", 100 + i, `분기 목표 ${i + 1}`, {
      horizon: "quarter" as const,
      period: `2027-Q${(i % 4) + 1}`,
    });
    edges.push({ source: g.id, target: pick(years).id, kind: "belongs" });
    return g;
  });
  const goals = [...years, ...quarters];
  const projects = Array.from({ length: 6 * scale }, (_, i) => {
    const area = pick(areas);
    const p = make("project", i, `프로젝트 ${i + 1}`, {
      areaId: area.id.slice(5),
      archived: rand() < 0.1,
    });
    edges.push({ source: p.id, target: area.id, kind: "belongs" });
    if (rand() < 0.8) edges.push({ source: p.id, target: pick(goals).id, kind: "belongs" });
    return p;
  });

  const remaining = Math.max(20, total - nodes.length);
  const items: GraphNode[] = [];
  for (let i = 0; i < remaining; i++) {
    const r = rand();
    const type: GraphNodeType =
      r < 0.45 ? "paper" : r < 0.6 ? "seminar" : r < 0.95 ? "thought" : "review";
    const label = { paper: "논문", seminar: "세미나", thought: "생각", review: "회고" }[
      type as "paper"
    ];
    const node = make(type, i, `${label} ${i + 1}`, { archived: rand() < 0.05 });
    items.push(node);
    tags.set(node.id, rand() < 0.6 ? [pick(TAGS)] : []);
    // Leave ~8% unconnected so "연결 없는 항목만" has something to show.
    if (rand() < 0.08) continue;
    edges.push({
      source: node.id,
      target: pick(projects).id,
      kind: rand() < 0.7 ? "link" : "body",
    });
    if (items.length > 3 && rand() < 0.5) {
      edges.push({
        source: node.id,
        target: pick(items.slice(0, -1)).id,
        kind: rand() < 0.5 ? "link" : "body",
      });
    }
  }

  TAGS.forEach((name, i) => {
    const tag = make("tag", i, name);
    for (const [id, names] of tags)
      if (names.includes(name)) edges.push({ source: id, target: tag.id, kind: "topic" });
  });

  return { ...withDegrees({ nodes, edges }), tags };
}
