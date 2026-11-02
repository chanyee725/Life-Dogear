/**
 * Graph data contract shared by the graph API (`/api/graph/**`) and the graph screens.
 * Plain types only: safe to import from client components.
 *
 * Node ids are `"<type>:<id>"`, e.g. `"project:3f2c…"`, `"tag:9a1b…"`.
 */

/** Item kinds that can appear as graph nodes. `tag` is a topic node (off by default). */
export const GRAPH_NODE_TYPES = [
  "goal",
  "area",
  "project",
  "paper",
  "seminar",
  "thought",
  "review",
  "tag",
] as const;
export type GraphNodeType = (typeof GRAPH_NODE_TYPES)[number];

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

/** Goal horizon: `"life"`, a year (`"2027"`) or a quarter (`"2027-Q1"`). */
export type GoalHorizon = string;

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
};

/**
 * - `belongs`: membership (quarter → year → life goal, project → goal, project → area, goal → area);
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
};

/** Query of `GET /api/graph/local?node=<type>:<id>&depth=1|2`. Response: `GraphData`. */
export type LocalGraphQuery = {
  node: GraphNodeId;
  depth: 1 | 2;
};

/** Saved node position (`graph_layout`). */
export type GraphPosition = { node: GraphNodeId; x: number; y: number };

/** Body of `PUT /api/graph/layout`. `DELETE /api/graph/layout` clears all positions. */
export type GraphLayoutBody = { positions: GraphPosition[] };

/** `GET /api/graph` also returns saved positions so the screen can pin them. */
export type GraphResponse = GraphData & { positions: GraphPosition[] };

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
  if (!id || !(GRAPH_NODE_TYPES as readonly string[]).includes(type)) return null;
  return { type: type as GraphNodeType, id };
}
