/**
 * Pure graph helpers for the graph screens (`docs/design/graph.md`): sizes, PARA columns,
 * label rules, neighbours, keyboard navigation, search, URL state and item routes.
 * No React, no DOM.
 */
import {
  DEFAULT_GRAPH_NODE_TYPES,
  GRAPH_NODE_TYPE_ORDER,
  type GraphData,
  type GraphEdge,
  type GraphFilter,
  type GraphNode,
  type GraphNodeId,
  type GraphNodeType,
  parseGraphNodeId,
} from "@/lib/graph/types";
import { isGraphColorBy, type GraphColorBy } from "@/lib/graph/color";
import { itemHref } from "@/lib/item-href";
import { tagPath } from "@/lib/item-path";

/** Korean labels for chips, PARA column titles and the preview. */
export const GRAPH_TYPE_LABEL: Record<GraphNodeType, string> = {
  goal: "목표",
  area: "영역",
  project: "프로젝트",
  paper: "논문",
  seminar: "세미나",
  thought: "생각",
  note: "노트",
  review: "회고",
  tag: "주제",
  task: "할 일",
};

/** Filter chip order; reviews and topics come after a divider and start off. */
export const GRAPH_TYPE_ORDER: readonly GraphNodeType[] = GRAPH_NODE_TYPE_ORDER;
export const OPT_IN_TYPES: readonly GraphNodeType[] = ["review", "tag", "task"];

/** Goal label with its horizon, e.g. "연 목표 2027". */
export function goalLabel(node: Pick<GraphNode, "horizon" | "period">): string {
  if (node.horizon === "life") return "인생 목표";
  const name = node.horizon === "quarter" ? "분기 목표" : "연 목표";
  return node.period ? `${name} ${node.period}` : name;
}

// ---------- Size (design 2.2) ----------

/** Base radius (graph units) by type. */
export function baseRadius(node: Pick<GraphNode, "type" | "horizon">): number {
  switch (node.type) {
    case "goal":
      return node.horizon === "life" ? 9 : node.horizon === "quarter" ? 6 : 7;
    case "area":
      return 6;
    case "project":
      return 5;
    case "review":
    case "tag":
      return 3.5;
    case "task":
      return 3;
    default:
      return 4;
  }
}

export const LARGE_GRAPH = 1500;
export const DENSE_GRAPH = 300;

/** `r = min(base + 1.2·√degree, 16)`; reviews and topics fixed at 3.5; base −1 (≥ 3) when large. */
export function nodeRadius(
  node: Pick<GraphNode, "type" | "horizon">,
  degree: number,
  large = false,
): number {
  if (node.type === "review" || node.type === "tag") return 3.5;
  if (node.type === "task") return 3;
  const base = large ? Math.max(baseRadius(node) - 1, 3) : baseRadius(node);
  return Math.min(base + 1.2 * Math.sqrt(Math.max(degree, 0)), 16);
}

// ---------- PARA columns (design 7.2) ----------

export const PARA_COLUMN_GAP = 280;
export type ParaColumn = { key: string; label: string; types: GraphNodeType[]; x: number };

const PARA_GROUPS: { key: string; label: string; types: GraphNodeType[] }[] = [
  { key: "goal", label: "목표", types: ["goal"] },
  { key: "area", label: "영역", types: ["area"] },
  { key: "project", label: "프로젝트", types: ["project"] },
  { key: "source", label: "자료", types: ["paper", "note", "seminar"] },
  { key: "thought", label: "생각", types: ["thought"] },
  { key: "review", label: "회고", types: ["review"] },
  { key: "tag", label: "주제", types: ["tag"] },
];

/** Columns for the shown types; hidden types' columns are dropped and the rest close up. */
export function paraColumns(shown: Iterable<GraphNodeType>): ParaColumn[] {
  const set = new Set(shown);
  return PARA_GROUPS.filter((g) => g.types.some((t) => set.has(t))).map((g, i) => ({
    ...g,
    x: i * PARA_COLUMN_GAP,
  }));
}

/** Column x per type (types without a column map to 0). */
export function paraXByType(columns: readonly ParaColumn[]): Record<GraphNodeType, number> {
  const out = Object.fromEntries(GRAPH_NODE_TYPE_ORDER.map((t) => [t, 0])) as Record<
    GraphNodeType,
    number
  >;
  for (const c of columns) for (const t of c.types) out[t] = c.x;
  return out;
}

/** Tasks sit just right of their parent's column (no column of their own). */
export const TASK_COLUMN_OFFSET = 70;

/** PARA x target of a node: its type's column; tasks: parent's column (+70), else projects'. */
export function paraTargetX(
  node: Pick<GraphNode, "type" | "parent">,
  paraX: Record<GraphNodeType, number>,
): number {
  if (node.type !== "task") return paraX[node.type];
  const parentType = node.parent ? parseGraphNodeId(node.parent)?.type : undefined;
  return paraX[parentType ?? "project"] + TASK_COLUMN_OFFSET;
}

/** Vertical target inside the goal column: life −240, year 0, quarter +240. */
export function goalRowY(horizon: GraphNode["horizon"]): number {
  return horizon === "life" ? -240 : horizon === "quarter" ? 240 : 0;
}

// ---------- Labels (design 5) ----------

/** Zoom level from which a node's label shows without emphasis. */
export function labelZoom(node: Pick<GraphNode, "type" | "horizon">, nodeCount: number): number {
  const dense = nodeCount > DENSE_GRAPH;
  if ((node.type === "goal" && node.horizon !== "quarter") || node.type === "area") {
    return dense ? 1.3 : 0.8;
  }
  if (node.type === "goal" || node.type === "project") return dense ? 1.8 : 1.3;
  return dense ? 2.5 : 2.0;
}

/** Label text: `#` for topics, ` · 보관` for archived, 18 chars (40 when emphasised). */
export function labelText(
  node: Pick<GraphNode, "type" | "title" | "archived" | "done">,
  emphasised: boolean,
): string {
  const max = emphasised ? 40 : 18;
  const base = node.type === "tag" ? `#${node.title}` : node.title;
  const cut = base.length > max ? `${base.slice(0, max - 1)}…` : base;
  const done = node.type === "task" && node.done ? `${cut} · 완료` : cut;
  return node.archived ? `${done} · 보관` : done;
}

/** Static label priority (lower first): goal > area > project > the rest > tasks. */
export function labelPriority(type: GraphNodeType): number {
  return type === "goal"
    ? 0
    : type === "area"
      ? 1
      : type === "project"
        ? 2
        : type === "task"
          ? 4
          : 3;
}

export type LabelBox = { x0: number; y0: number; x1: number; y1: number };

/**
 * Overlap avoidance for one label: the index of the first candidate box (long text first,
 * then shorter) that, grown by `margin`, overlaps no label already drawn; -1 = hide it.
 */
export function fitLabel(
  candidates: readonly LabelBox[],
  placed: readonly LabelBox[],
  margin = 0,
): number {
  return candidates.findIndex(
    (c) =>
      !placed.some(
        (b) =>
          c.x0 - margin < b.x1 &&
          b.x0 < c.x1 + margin &&
          c.y0 - margin < b.y1 &&
          b.y0 < c.y1 + margin,
      ),
  );
}

/** Neighbour labels in priority order (goal > area > project > rest > task, bigger first). */
export function byLabelPriority<T extends { id: string; type: GraphNodeType; size: number }>(
  nodes: Iterable<T>,
): T[] {
  return [...nodes].sort(
    (a, b) =>
      labelPriority(a.type) - labelPriority(b.type) ||
      b.size - a.size ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

// ---------- Edges and neighbours ----------

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Edges ready to draw: ends must be in the node list, no self loops, and a `link` and a
 * `body` edge between the same pair collapse into one line (design 3).
 */
export function drawableEdges(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): GraphEdge[] {
  const ids = new Set(nodes.map((n) => n.id));
  const seen = new Set<string>();
  const out: GraphEdge[] = [];
  for (const e of edges) {
    if (e.source === e.target || !ids.has(e.source) || !ids.has(e.target)) continue;
    const kind = e.kind === "body" ? "link" : e.kind;
    const key = `${kind}:${pairKey(e.source, e.target)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

/** Node id → directly connected node ids. */
export function buildNeighbors(edges: readonly GraphEdge[]): Map<GraphNodeId, Set<GraphNodeId>> {
  const map = new Map<GraphNodeId, Set<GraphNodeId>>();
  const add = (a: GraphNodeId, b: GraphNodeId) => {
    let set = map.get(a);
    if (!set) map.set(a, (set = new Set()));
    set.add(b);
  };
  for (const e of edges) {
    if (e.source === e.target) continue;
    add(e.source, e.target);
    add(e.target, e.source);
  }
  return map;
}

/** Degree per node over the given edges. */
export function degrees(edges: readonly GraphEdge[]): Map<GraphNodeId, number> {
  const out = new Map<GraphNodeId, number>();
  for (const [id, set] of buildNeighbors(edges)) out.set(id, set.size);
  return out;
}

/** Step distance from `center` (0) for nodes within `depth`. */
export function distancesFrom(
  edges: readonly GraphEdge[],
  center: GraphNodeId,
  depth: number,
): Map<GraphNodeId, number> {
  const neighbors = buildNeighbors(edges);
  const dist = new Map<GraphNodeId, number>([[center, 0]]);
  let frontier = [center];
  for (let d = 1; d <= depth; d++) {
    const next: GraphNodeId[] = [];
    for (const id of frontier) {
      for (const n of neighbors.get(id) ?? []) {
        if (dist.has(n)) continue;
        dist.set(n, d);
        next.push(n);
      }
    }
    frontier = next;
  }
  return dist;
}

/** Nodes within `depth` steps of `center` (mock / tests), sizes = degree in the subgraph. */
export function localSubgraph(data: GraphData, center: GraphNodeId, depth: 1 | 2): GraphData {
  const dist = distancesFrom(data.edges, center, depth);
  const nodes = data.nodes.filter((n) => dist.has(n.id));
  const edges = drawableEdges(nodes, data.edges);
  const deg = degrees(edges);
  return { nodes: nodes.map((n) => ({ ...n, size: deg.get(n.id) ?? 0 })), edges };
}

// ---------- Keyboard navigation (design 11.1) ----------

export type Direction = "left" | "right" | "up" | "down";
type Positioned = { id: GraphNodeId; x?: number; y?: number };

const DIR_ANGLE: Record<Direction, number> = {
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
  up: -Math.PI / 2,
};

/**
 * Nearest node in `dir` (within ±45°) from `from`, preferring connected neighbours,
 * falling back to every node. Screen y grows downward.
 */
export function nodeInDirection(
  from: Positioned,
  dir: Direction,
  nodes: readonly Positioned[],
  neighbors: ReadonlySet<GraphNodeId> | undefined,
): GraphNodeId | null {
  const fx = from.x ?? 0;
  const fy = from.y ?? 0;
  const want = DIR_ANGLE[dir];
  const best = (pool: readonly Positioned[]) => {
    let id: GraphNodeId | null = null;
    let bestDist = Infinity;
    for (const n of pool) {
      if (n.id === from.id || n.x == null || n.y == null) continue;
      const dx = n.x - fx;
      const dy = n.y - fy;
      const dist = Math.hypot(dx, dy);
      if (dist === 0) continue;
      let diff = Math.abs(Math.atan2(dy, dx) - want);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      if (diff > Math.PI / 4 + 1e-9) continue;
      if (dist < bestDist) {
        bestDist = dist;
        id = n.id;
      }
    }
    return id;
  };
  if (neighbors && neighbors.size > 0) {
    const near = best(nodes.filter((n) => neighbors.has(n.id)));
    if (near) return near;
  }
  return best(nodes);
}

/** Next/previous neighbour of `center` after `current` (`[` / `]`), sorted by title. */
export function cycleNeighbor(
  center: GraphNodeId,
  current: GraphNodeId | null,
  step: 1 | -1,
  neighbors: ReadonlySet<GraphNodeId> | undefined,
  titleOf: (id: GraphNodeId) => string,
): GraphNodeId | null {
  if (!neighbors || neighbors.size === 0) return null;
  const list = [...neighbors].sort(
    (a, b) => titleOf(a).localeCompare(titleOf(b), "ko") || (a < b ? -1 : 1),
  );
  const at = current ? list.indexOf(current) : -1;
  if (at < 0) return step === 1 ? list[0]! : list[list.length - 1]!;
  return list[(at + step + list.length) % list.length]!;
}

/** Starting node for keyboard focus: the selection, else the biggest life goal, else the most connected. */
export function initialFocus(
  nodes: readonly GraphNode[],
  selected: GraphNodeId | null,
): GraphNodeId | null {
  if (selected && nodes.some((n) => n.id === selected)) return selected;
  const pickMax = (pool: readonly GraphNode[]) =>
    pool.reduce<GraphNode | null>((best, n) => (!best || n.size > best.size ? n : best), null);
  const life = pickMax(nodes.filter((n) => n.type === "goal" && n.horizon === "life"));
  return (life ?? pickMax(nodes))?.id ?? null;
}

// ---------- Search ----------

function norm(s: string): string {
  return s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Title search: prefix matches first, then substring; ties keep the better-connected node first. */
export function searchNodes(nodes: readonly GraphNode[], query: string, limit = 8): GraphNode[] {
  const q = norm(query);
  if (!q) return [];
  const scored: { node: GraphNode; rank: number }[] = [];
  for (const node of nodes) {
    const at = norm(node.title).indexOf(q);
    if (at >= 0) scored.push({ node, rank: at === 0 ? 0 : 1 });
  }
  scored.sort((a, b) => a.rank - b.rank || b.node.size - a.node.size);
  return scored.slice(0, limit).map((s) => s.node);
}

// ---------- Routes ----------

const ROUTE: Record<GraphNodeType, string> = {
  goal: "/goals",
  area: "/areas",
  project: "/projects",
  paper: "/papers",
  seminar: "/seminars",
  thought: "/thoughts",
  note: "/notes",
  review: "/reviews",
  tag: "/tags",
  task: "/tasks",
};

/**
 * Detail page of a node. Topic nodes open the tag page by name; tasks have no page and
 * open their parent (unfiled ones `/tasks`).
 */
export function nodeHref(node: Pick<GraphNode, "id" | "title" | "parent">): string | null {
  const parsed = parseGraphNodeId(node.id);
  if (!parsed) return null;
  if (parsed.type === "tag") return tagPath(node.title);
  if (parsed.type === "task") {
    const parent = node.parent ? parseGraphNodeId(node.parent) : null;
    return parent && parent.type !== "task" && parent.type !== "tag"
      ? itemHref(parent.type, parent.id)
      : ROUTE.task;
  }
  return itemHref(parsed.type, parsed.id, node.title);
}

// ---------- Filter and URL state (design 6.2) ----------

export type GraphView = "free" | "para";
/** `basic` = the quiet graph (docs/design/graph.md); `cosmos` = docs/design/cosmos.md. */
export type GraphMode = "basic" | "cosmos";
export type GraphUrlState = {
  filter: GraphFilter;
  view: GraphView;
  focus: GraphNodeId | null;
  /** Absent from the URL when not given (the screen then uses the last choice). */
  mode?: GraphMode;
  /** Basic graph color basis (`color=area`); absent → the last choice. */
  color?: GraphColorBy;
};
export const GRAPH_MODE_STORAGE_KEY = "rb-graph-mode";

const sameTypes = (a: readonly GraphNodeType[], b: readonly GraphNodeType[]) =>
  a.length === b.length && a.every((t) => b.includes(t));

/** Normalised filter: types in chip order, defaults dropped. */
export function normalizeFilter(filter: GraphFilter): GraphFilter {
  const out: GraphFilter = {};
  if (filter.types) {
    const types = GRAPH_TYPE_ORDER.filter((t) => filter.types!.includes(t));
    if (!sameTypes(types, DEFAULT_GRAPH_NODE_TYPES)) out.types = types;
  }
  if (filter.area) out.area = filter.area;
  if (filter.tag) out.tag = filter.tag;
  if (filter.archived) out.archived = true;
  if (filter.orphans) out.orphans = true;
  // Only meaningful while task nodes are shown.
  if (filter.doneTasks && out.types?.includes("task")) out.doneTasks = true;
  return out;
}

export function isDefaultFilter(filter: GraphFilter): boolean {
  return Object.keys(normalizeFilter(filter)).length === 0;
}

/** Number of active conditions (the "필터 n" button on narrow screens). */
export function activeFilterCount(filter: GraphFilter): number {
  const f = normalizeFilter(filter);
  return (
    (f.types ? 1 : 0) +
    (f.area ? 1 : 0) +
    (f.tag ? 1 : 0) +
    (f.archived ? 1 : 0) +
    (f.orphans ? 1 : 0) +
    (f.doneTasks ? 1 : 0)
  );
}

export function shownTypes(filter: GraphFilter): GraphNodeType[] {
  return [...(filter.types ?? DEFAULT_GRAPH_NODE_TYPES)];
}

/** `/api/graph` query string (`?…`, or empty for defaults). */
export function graphQuery(filter: GraphFilter): string {
  const f = normalizeFilter(filter);
  const p = new URLSearchParams();
  if (f.types) p.set("types", f.types.join(","));
  if (f.area) p.set("area", f.area);
  if (f.tag) p.set("tag", f.tag);
  if (f.archived) p.set("archived", "1");
  if (f.orphans) p.set("orphans", "1");
  if (f.doneTasks) p.set("doneTasks", "1");
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Page URL query for the current filter, view and focus. */
export function pageQuery(state: GraphUrlState): string {
  const p = new URLSearchParams(graphQuery(state.filter));
  if (state.view === "para") p.set("view", "para");
  if (state.mode === "cosmos") p.set("mode", "cosmos");
  if (state.color === "area") p.set("color", "area");
  if (state.focus) p.set("focus", state.focus);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Reads the page URL query; unknown values fall back to defaults. */
export function parsePageQuery(params: URLSearchParams): GraphUrlState {
  const filter: GraphFilter = {};
  const types = params.get("types");
  if (types !== null) {
    const wanted = new Set(types.split(","));
    filter.types = GRAPH_TYPE_ORDER.filter((t) => wanted.has(t));
  }
  const area = params.get("area");
  if (area) filter.area = area;
  const tag = params.get("tag")?.trim();
  if (tag) filter.tag = tag;
  if (params.get("archived") === "1") filter.archived = true;
  if (params.get("orphans") === "1") filter.orphans = true;
  if (params.get("doneTasks") === "1") filter.doneTasks = true;
  const focusRef = parseGraphNodeId(params.get("focus"));
  const color = params.get("color");
  return {
    filter: normalizeFilter(filter),
    view: params.get("view") === "para" ? "para" : "free",
    ...(params.get("mode") === "cosmos"
      ? { mode: "cosmos" as const }
      : params.get("mode") === "basic"
        ? { mode: "basic" as const }
        : {}),
    ...(isGraphColorBy(color) ? { color } : {}),
    focus: focusRef ? (`${focusRef.type}:${focusRef.id}` as GraphNodeId) : null,
  };
}

/**
 * d3-zoom event filter for the local graph: drag pan, pinch and button zoom always work;
 * the mouse wheel zooms only once the graph is active (clicked or focused), or with Ctrl/⌘,
 * so scrolling the page past the card never gets caught by the graph.
 */
export function allowLocalZoomEvent(
  e: Pick<MouseEvent, "type" | "ctrlKey" | "metaKey">,
  wheelActive: boolean,
): boolean {
  return e.type !== "wheel" || wheelActive || e.ctrlKey || e.metaKey;
}
