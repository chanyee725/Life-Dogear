/** Parsing and validation of graph API inputs. Pure; shared by the routes and tests. */
import { isValidItemId } from "@/lib/ids";
import {
  GRAPH_NODE_TYPES,
  parseGraphNodeId,
  type GraphFilter,
  type GraphNodeId,
  type GraphNodeType,
  type GraphPosition,
  type LocalGraphQuery,
} from "./types";

const MAX_TAG_LENGTH = 100;
/** Upper bound for one layout save (the graph targets a few thousand nodes). */
export const MAX_LAYOUT_POSITIONS = 20_000;
/** Bytes; ~20k positions at ~70 bytes each. */
export const MAX_LAYOUT_BODY = 2_000_000;
const MAX_COORD = 1e7;

const flag = (value: string | null): boolean => value === "1" || value === "true";

/** Unknown types and malformed values are ignored rather than rejected. */
export function parseGraphFilter(params: URLSearchParams): GraphFilter {
  const filter: GraphFilter = {};

  const typesParam = params.get("types");
  if (typesParam !== null) {
    const wanted = new Set(typesParam.split(",").map((t) => t.trim()));
    filter.types = GRAPH_NODE_TYPES.filter((t) => wanted.has(t));
  }

  const area = params.get("area");
  if (area && isValidItemId(area)) filter.area = area;

  const tag = params.get("tag")?.normalize("NFC").trim();
  if (tag && tag.length <= MAX_TAG_LENGTH) filter.tag = tag;

  if (flag(params.get("archived"))) filter.archived = true;
  if (flag(params.get("orphans"))) filter.orphans = true;
  return filter;
}

/** A node id whose item id is a valid id (tags and items share the same id format). */
export function parseNodeRef(value: unknown): { type: GraphNodeType; id: string } | null {
  const ref = parseGraphNodeId(value);
  return ref && isValidItemId(ref.id) ? ref : null;
}

export function parseLocalQuery(params: URLSearchParams): LocalGraphQuery | null {
  const ref = parseNodeRef(params.get("node"));
  // Topic nodes have no detail screen, so no local graph.
  if (!ref || ref.type === "tag") return null;
  const depth = params.get("depth") === "2" ? 2 : 1;
  return { node: `${ref.type}:${ref.id}` as GraphNodeId, depth };
}

/** `{ positions: {node, x, y}[] }`, or null when malformed. Later duplicates win. */
export function parseLayoutBody(body: unknown): GraphPosition[] | null {
  if (typeof body !== "object" || body === null) return null;
  const list = (body as { positions?: unknown }).positions;
  if (!Array.isArray(list) || list.length > MAX_LAYOUT_POSITIONS) return null;

  const byNode = new Map<GraphNodeId, GraphPosition>();
  for (const entry of list) {
    if (typeof entry !== "object" || entry === null) return null;
    const { node, x, y } = entry as Record<string, unknown>;
    const ref = parseNodeRef(node);
    if (!ref || !isCoord(x) || !isCoord(y)) return null;
    const id = `${ref.type}:${ref.id}` as GraphNodeId;
    byNode.set(id, { node: id, x, y });
  }
  return [...byNode.values()];
}

const isCoord = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= MAX_COORD;
