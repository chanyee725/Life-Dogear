/**
 * Pure graph computation: rows in, `{ nodes, edges }` out. No database access, so it
 * can be unit-tested and stays linear in the number of rows (no per-node queries).
 */
import {
  DEFAULT_GRAPH_NODE_TYPES,
  GRAPH_NODE_TYPES,
  graphNodeId,
  type GraphData,
  type GraphEdge,
  type GraphEdgeKind,
  type GraphFilter,
  type GraphNode,
  type GraphNodeId,
  type GraphNodeType,
} from "./types";

export type ItemNodeType = Exclude<GraphNodeType, "tag">;

/** One row per item. Membership columns are filled only where the type has them. */
export type SourceItem = {
  type: ItemNodeType;
  id: string;
  title: string;
  archived: boolean;
  /** Projects and goals. */
  areaId?: string | null;
  /** Projects: the goal they serve. */
  goalId?: string | null;
  /** Goals: parent goal (quarter → year → life). */
  parentGoalId?: string | null;
  /** Goals: `life`, `2027`, `2027-Q1`. */
  horizon?: string;
};

export type SourceLink = {
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  /** `links.via`; missing means `manual`. */
  via?: string | null;
};

export type SourceTagging = { itemType: string; itemId: string; tagId: string };
export type SourceTag = { id: string; name: string };

export type GraphSource = {
  items: SourceItem[];
  links: SourceLink[];
  tags?: SourceTag[];
  itemTags?: SourceTagging[];
};

export const ITEM_NODE_TYPES = GRAPH_NODE_TYPES.filter((t): t is ItemNodeType => t !== "tag");

const edgeKey = (a: string, b: string, kind: GraphEdgeKind) =>
  a < b ? `${kind}|${a}|${b}` : `${kind}|${b}|${a}`;

/** All nodes and edges among `items` (archived included), before filtering. */
function fullGraph(source: GraphSource, withTags: boolean) {
  const nodes = new Map<GraphNodeId, GraphNode>();
  for (const item of source.items) {
    const node: GraphNode = {
      id: graphNodeId(item.type, item.id),
      type: item.type,
      title: item.title,
      size: 0,
      archived: item.archived,
    };
    if (item.areaId) node.areaId = item.areaId;
    if (item.type === "goal" && item.horizon) node.horizon = item.horizon;
    nodes.set(node.id, node);
  }

  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  const add = (source: GraphNodeId, target: GraphNodeId, kind: GraphEdgeKind) => {
    if (source === target || !nodes.has(source) || !nodes.has(target)) return;
    const key = edgeKey(source, target, kind);
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ source, target, kind });
  };

  // Membership: child → parent.
  for (const item of source.items) {
    const self = graphNodeId(item.type, item.id);
    if (item.type === "goal" && item.parentGoalId) {
      add(self, graphNodeId("goal", item.parentGoalId), "belongs");
    }
    if (item.type === "project" && item.goalId) {
      add(self, graphNodeId("goal", item.goalId), "belongs");
    }
    if ((item.type === "project" || item.type === "goal") && item.areaId) {
      add(self, graphNodeId("area", item.areaId), "belongs");
    }
  }

  for (const l of source.links) {
    add(
      `${l.sourceType}:${l.sourceId}` as GraphNodeId,
      `${l.targetType}:${l.targetId}` as GraphNodeId,
      l.via === "body" ? "body" : "link",
    );
  }

  if (withTags && source.tags && source.itemTags) {
    const names = new Map(source.tags.map((t) => [t.id, t.name]));
    for (const it of source.itemTags) {
      const item = `${it.itemType}:${it.itemId}` as GraphNodeId;
      const name = names.get(it.tagId);
      if (name === undefined || !nodes.has(item)) continue;
      const tag = graphNodeId("tag", it.tagId);
      if (!nodes.has(tag)) {
        nodes.set(tag, { id: tag, type: "tag", title: name, size: 0, archived: false });
      }
      add(item, tag, "topic");
    }
  }

  return { nodes, edges };
}

function adjacency(edges: readonly GraphEdge[]) {
  const adj = new Map<GraphNodeId, GraphNodeId[]>();
  const push = (a: GraphNodeId, b: GraphNodeId) => {
    const list = adj.get(a);
    if (list) list.push(b);
    else adj.set(a, [b]);
  };
  for (const e of edges) {
    push(e.source, e.target);
    push(e.target, e.source);
  }
  return adj;
}

/** Restricts to `keep`, drops dangling edges, and sets `size` to the degree. */
function finish(
  nodes: Map<GraphNodeId, GraphNode>,
  edges: readonly GraphEdge[],
  keep: (node: GraphNode) => boolean,
): GraphData {
  const kept = new Map<GraphNodeId, GraphNode>();
  for (const node of nodes.values()) if (keep(node)) kept.set(node.id, { ...node, size: 0 });
  const outEdges = edges.filter((e) => kept.has(e.source) && kept.has(e.target));
  for (const e of outEdges) {
    kept.get(e.source)!.size++;
    kept.get(e.target)!.size++;
  }
  return { nodes: [...kept.values()], edges: outEdges };
}

/** Ids of items tagged `tagName` (case-insensitive), as node ids. */
function taggedWith(source: GraphSource, tagName: string): Set<GraphNodeId> {
  const wanted = tagName.normalize("NFC").trim().toLowerCase();
  const tagIds = new Set(
    (source.tags ?? []).filter((t) => t.name.toLowerCase() === wanted).map((t) => t.id),
  );
  const out = new Set<GraphNodeId>();
  for (const it of source.itemTags ?? []) {
    if (tagIds.has(it.tagId)) out.add(`${it.itemType}:${it.itemId}` as GraphNodeId);
  }
  for (const id of tagIds) out.add(graphNodeId("tag", id));
  return out;
}

/**
 * The area itself, everything that belongs to it (directly or through goals:
 * area ← goal ← child goal ← project), plus direct neighbours of that set.
 */
function areaScope(
  nodes: Map<GraphNodeId, GraphNode>,
  edges: readonly GraphEdge[],
  areaId: string,
): Set<GraphNodeId> {
  const area = graphNodeId("area", areaId);
  const core = new Set<GraphNodeId>();
  if (!nodes.has(area)) return core;
  core.add(area);

  // Walk membership edges downward (target = parent) from the area.
  const children = new Map<GraphNodeId, GraphNodeId[]>();
  for (const e of edges) {
    if (e.kind !== "belongs") continue;
    const list = children.get(e.target);
    if (list) list.push(e.source);
    else children.set(e.target, [e.source]);
  }
  const queue = [area];
  while (queue.length) {
    for (const child of children.get(queue.pop()!) ?? []) {
      if (!core.has(child)) {
        core.add(child);
        queue.push(child);
      }
    }
  }

  const scope = new Set(core);
  for (const e of edges) {
    if (core.has(e.source)) scope.add(e.target);
    if (core.has(e.target)) scope.add(e.source);
  }
  return scope;
}

function normalizeTypes(types: GraphFilter["types"]): Set<GraphNodeType> {
  return new Set(types && types.length ? types : DEFAULT_GRAPH_NODE_TYPES);
}

/** The whole graph for `/graph`, filtered. */
export function buildGraph(source: GraphSource, filter: GraphFilter = {}): GraphData {
  const types = normalizeTypes(filter.types);
  const visible = (n: GraphNode) => types.has(n.type) && (filter.archived || !n.archived);

  const { nodes, edges: all } = fullGraph(source, types.has("tag"));
  // Edges only among visible nodes, so hidden types/archived items do not pull others in.
  const edges = all.filter((e) => visible(nodes.get(e.source)!) && visible(nodes.get(e.target)!));

  let scope: Set<GraphNodeId> | null = null;
  const narrow = (next: Set<GraphNodeId>) => {
    scope = scope ? new Set([...scope].filter((id) => next.has(id))) : next;
  };
  if (filter.area) narrow(areaScope(nodes, edges, filter.area));
  if (filter.tag) narrow(taggedWith(source, filter.tag));

  const inScope = (n: GraphNode) => visible(n) && (scope === null || scope.has(n.id));

  if (filter.orphans) {
    // Topic edges do not count as connections, and topic nodes are not shown here.
    const scoped = edges.filter(
      (e) => e.kind !== "topic" && inScope(nodes.get(e.source)!) && inScope(nodes.get(e.target)!),
    );
    const connected = new Set(scoped.flatMap((e) => [e.source, e.target]));
    return finish(nodes, [], (n) => n.type !== "tag" && inScope(n) && !connected.has(n.id));
  }

  return finish(nodes, edges, inScope);
}

/**
 * Neighbourhood of `center` up to `depth` steps, for the local graph on detail screens.
 * Uses every item type except topics; archived neighbours are left out (the center is
 * always included). Returns an empty graph when the center does not exist.
 */
export function buildLocalGraph(
  source: GraphSource,
  center: GraphNodeId,
  depth: 1 | 2,
): GraphData {
  const { nodes, edges: all } = fullGraph(source, false);
  const c = nodes.get(center);
  if (!c) return { nodes: [], edges: [] };

  const allowed = (n: GraphNode) => n.id === center || !n.archived;
  const edges = all.filter((e) => allowed(nodes.get(e.source)!) && allowed(nodes.get(e.target)!));
  const adj = adjacency(edges);

  const reached = new Set<GraphNodeId>([center]);
  let frontier: GraphNodeId[] = [center];
  for (let step = 0; step < depth; step++) {
    const next: GraphNodeId[] = [];
    for (const id of frontier) {
      for (const nb of adj.get(id) ?? []) {
        if (!reached.has(nb)) {
          reached.add(nb);
          next.push(nb);
        }
      }
    }
    frontier = next;
  }
  return finish(nodes, edges, (n) => reached.has(n.id));
}
