/**
 * Graph data contract shared by the graph API (`/api/graph/**`) and the graph screens.
 * Plain types only: safe to import from client components.
 *
 * Node ids are `"<type>:<id>"`, e.g. `"project:3f2c…"`, `"tag:9a1b…"`.
 */
// Type-only import: the schema module never reaches client bundles from here.
import type { GRAPH_NODE_TYPES } from "@/db/schema";
import type { GoalHorizon } from "@/lib/enums";

/** Item kinds that can appear as graph nodes (`graph_layout.node_type`). `tag` = topic node. */
export type GraphNodeType = (typeof GRAPH_NODE_TYPES)[number];

/**
 * Every node type in display order — the PARA flow from life goals to notes, for filter
 * checkboxes and PARA columns. Same members as the schema's `GRAPH_NODE_TYPES`; the
 * `satisfies` check below fails to compile if a type is missing.
 */
export const GRAPH_NODE_TYPE_ORDER = [
  "goal",
  "area",
  "project",
  "paper",
  "seminar",
  "thought",
  "review",
  "tag",
  "task",
] as const satisfies readonly GraphNodeType[];

type MissingFromOrder = Exclude<GraphNodeType, (typeof GRAPH_NODE_TYPE_ORDER)[number]>;
// Compile-time: `never` unless a schema node type is missing from the order above.
const ORDER_IS_COMPLETE: MissingFromOrder extends never ? true : never = true;
void ORDER_IS_COMPLETE;

/** Types shown when the `types` filter is not given (topics and reviews are opt-in). */
export const DEFAULT_GRAPH_NODE_TYPES: readonly GraphNodeType[] = [
  "goal",
  "area",
  "project",
  "paper",
  "seminar",
  "thought",
];

/** `"<type>:<id>"`. */
export type GraphNodeId = `${GraphNodeType}:${string}`;

export type { GoalHorizon };

export type GraphNode = {
  id: GraphNodeId;
  type: GraphNodeType;
  title: string;
  /** Number of edges touching this node in the returned graph (degree). */
  size: number;
  archived: boolean;
  /** Area the node belongs to (projects and goals), when set. */
  areaId?: string;
  /** Goals only. */
  horizon?: GoalHorizon;
  /** Goals (`2027`, `2027-Q1`; absent for life goals) and reviews (`2026-W45`, `2026-11`, …). */
  period?: string;
  /** Tasks only: completed. */
  done?: boolean;
  /** Tasks only: `YYYY-MM-DD`. */
  dueDate?: string;
  /** Tasks only: the parent project/goal/area node (absent for unfiled tasks). */
  parent?: GraphNodeId;
};

/**
 * - `belongs`: membership (quarter → year → life goal, project → goal, project → area, goal → area,
 *   task → its project/goal/area);
 *   source is the child, target the parent.
 * - `link`: a manual link (`links.via = 'manual'`).
 * - `body`: a `[[wikilink]]` in a body (`links.via = 'body'`).
 * - `topic`: item → tag node (only when `tag` nodes are requested).
 */
export const GRAPH_EDGE_KINDS = ["belongs", "link", "body", "topic"] as const;
export type GraphEdgeKind = (typeof GRAPH_EDGE_KINDS)[number];

export type GraphEdge = {
  source: GraphNodeId;
  target: GraphNodeId;
  kind: GraphEdgeKind;
};

export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

/** Query of `GET /api/graph?types=&area=&tag=&archived=0|1&orphans=0|1`. */
export type GraphFilter = {
  /** Comma-separated in the URL. Default: `DEFAULT_GRAPH_NODE_TYPES`. */
  types?: GraphNodeType[];
  /** Area id: keep the area, items belonging to it, and their direct neighbours. */
  area?: string;
  /** Tag name: keep only items with this tag (case-insensitive). */
  tag?: string;
  /** Include archived items. Default false. */
  archived?: boolean;
  /** Only nodes with no edges ("연결 없는 항목만"). Default false. */
  orphans?: boolean;
  /** With `task` in `types`: also completed tasks (`doneTasks=1`). Default false. */
  doneTasks?: boolean;
};

/**
 * Query of `GET /api/graph/local?node=<type>:<id>&depth=1|2` (item nodes only; `tag:` → 400).
 * Response: `LocalGraphData`.
 */
export type LocalGraphQuery = {
  node: GraphNodeId;
  depth: 1 | 2;
};

/** Local graph response; capped at 500 nodes, `truncated` when neighbours were left out. */
export type LocalGraphData = GraphData & { truncated: boolean };

/** Saved node position (`graph_layout`). */
export type GraphPosition = { node: GraphNodeId; x: number; y: number };

/** Body of `PUT /api/graph/layout`. `DELETE /api/graph/layout` clears all positions. */
export type GraphLayoutBody = { positions: GraphPosition[] };

/** `GET /api/graph` also returns saved positions so the screen can pin them. */
export type GraphResponse = GraphData & {
  positions: GraphPosition[];
  /**
   * Every area id (archived too, filtered out or not) in sidebar order — the area color
   * order shared with the cosmos view. Absent from mocks and older responses.
   */
  areaOrder?: string[];
};

export function graphNodeId(type: GraphNodeType, id: string): GraphNodeId {
  return `${type}:${id}`;
}

/** Splits `"<type>:<id>"`; null when the type is unknown or the id is empty. */
export function parseGraphNodeId(value: unknown): { type: GraphNodeType; id: string } | null {
  if (typeof value !== "string") return null;
  const at = value.indexOf(":");
  if (at <= 0) return null;
  const type = value.slice(0, at);
  const id = value.slice(at + 1);
  if (!id || !(GRAPH_NODE_TYPE_ORDER as readonly string[]).includes(type)) return null;
  return { type: type as GraphNodeType, id };
}
