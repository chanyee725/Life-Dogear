import type { RoadmapKind, RoadmapNode } from "@/lib/repo/roadmap-types";

/** One box's size, in layout px (before zoom). */
export interface BoxSize {
  width: number;
  height: number;
}

/** Box size and spacing, in layout px (before zoom). */
export interface LayoutSize {
  /** Fallback box size for kinds missing from `kinds`. */
  nodeWidth: number;
  nodeHeight: number;
  /** Horizontal gap between a column and the next (room for the curved edges). */
  colGap: number;
  /** Vertical gap between stacked boxes. */
  rowGap: number;
  /** Extra vertical room between two root subtrees (areas), so each reads as its own branch. */
  branchGap?: number;
  /** Per-kind box sizes: the visual hierarchy (big area, slim task pill). */
  kinds?: Partial<Record<RoadmapKind, BoxSize>>;
}

export const DEFAULT_SIZE: LayoutSize = {
  nodeWidth: 232,
  nodeHeight: 60,
  colGap: 64,
  rowGap: 12,
  branchGap: 20,
  kinds: {
    area: { width: 216, height: 68 },
    goal: { width: 240, height: 60 },
    project: { width: 240, height: 60 },
    task: { width: 204, height: 32 },
  },
};

/** Size of one node's box under `size`. */
export const boxSize = (kind: RoadmapKind, size: LayoutSize = DEFAULT_SIZE): BoxSize =>
  size.kinds?.[kind] ?? { width: size.nodeWidth, height: size.nodeHeight };

export interface PlacedNode {
  /** Path from the root (`goal-1/project-2`): unique even if a node shows up twice. */
  key: string;
  /** `kind-id`: the collapse key and the test id suffix. */
  id: string;
  node: RoadmapNode;
  depth: number;
  /** Index of the root (area) this node grows from: picks the branch colour. */
  branch: number;
  /** Top-left corner of the box. */
  x: number;
  y: number;
  width: number;
  height: number;
  parentKey: string | null;
  collapsed: boolean;
}

export interface PlacedEdge {
  key: string;
  /** Depth of the child end (1 = root's direct child). Drives the stroke weight. */
  depth: number;
  branch: number;
  /** Parent box's right-middle → child box's left-middle. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface TreeLayout {
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  width: number;
  height: number;
}

export const nodeId = (n: Pick<RoadmapNode, "kind" | "id">): string => `${n.kind}-${n.id}`;

/** Collapsed on first render: nodes holding tasks (a project's task list); the rest open. */
export function defaultCollapsed(roots: readonly RoadmapNode[]): Set<string> {
  const out = new Set<string>();
  const walk = (n: RoadmapNode) => {
    if (n.children.some((c) => c.kind === "task")) out.add(nodeId(n));
    n.children.forEach(walk);
  };
  roots.forEach(walk);
  return out;
}

/**
 * Left-to-right tidy tree. Each depth is a column (as wide as its widest box); visible
 * leaves stack top to bottom in order, and every parent sits at the vertical middle of its
 * first and last child. A subtree owns a contiguous band of rows at least as tall as its
 * own box, so boxes never overlap. Children of a collapsed node are left out. The roots
 * hang off an implicit virtual root (drawn by the caller, see `rootAnchor`).
 */
export function layoutTree(
  roots: readonly RoadmapNode[],
  collapsed: ReadonlySet<string>,
  size: LayoutSize = DEFAULT_SIZE,
): TreeLayout {
  const { colGap, rowGap } = size;
  const branchGap = size.branchGap ?? 0;
  const nodes: PlacedNode[] = [];
  const colWidth: number[] = [];
  let cursor = 0; // top of the next free row

  /** Moves every node placed from index `from` on down by `dy`. */
  const shift = (from: number, dy: number) => {
    for (let i = from; i < nodes.length; i++) nodes[i].y += dy;
  };

  // Returns the placed node's centre y.
  const place = (n: RoadmapNode, depth: number, branch: number, parent: PlacedNode | null): number => {
    const id = nodeId(n);
    const key = parent ? `${parent.key}/${id}` : id;
    const isCollapsed = collapsed.has(id) && n.children.length > 0;
    const { width, height } = boxSize(n.kind, size);
    const placed: PlacedNode = {
      key,
      id,
      node: n,
      depth,
      branch,
      x: 0,
      y: 0,
      width,
      height,
      parentKey: parent?.key ?? null,
      collapsed: isCollapsed,
    };
    nodes.push(placed);
    colWidth[depth] = Math.max(colWidth[depth] ?? 0, width);

    const kids = isCollapsed ? [] : n.children;
    if (kids.length === 0) {
      placed.y = cursor;
      cursor += height + rowGap;
      return placed.y + height / 2;
    }
    const top = cursor;
    const firstKid = nodes.length;
    const centres = kids.map((c) => place(c, depth + 1, branch, placed));
    let mid = (centres[0] + centres[centres.length - 1]) / 2;
    // A box taller than its children's band would poke into the neighbours: grow the band.
    const band = cursor - rowGap - top;
    if (height > band) {
      const dy = (height - band) / 2;
      shift(firstKid, dy);
      mid += dy;
      cursor = top + height + rowGap;
    }
    const over = top - (mid - height / 2);
    if (over > 0) {
      shift(firstKid, over);
      mid += over;
      cursor += over;
    }
    placed.y = mid - height / 2;
    return mid;
  };

  roots.forEach((r, i) => {
    if (i > 0) cursor += branchGap;
    place(r, 0, i, null);
  });

  const colX: number[] = [];
  colWidth.forEach((w, d) => (colX[d] = d === 0 ? 0 : colX[d - 1] + colWidth[d - 1] + colGap));
  for (const p of nodes) p.x = colX[p.depth];

  const byKey = new Map(nodes.map((p) => [p.key, p]));
  const edges: PlacedEdge[] = [];
  for (const child of nodes) {
    if (child.parentKey === null) continue;
    const parent = byKey.get(child.parentKey)!;
    edges.push({
      key: child.key,
      depth: child.depth,
      branch: child.branch,
      x1: parent.x + parent.width,
      y1: parent.y + parent.height / 2,
      x2: child.x,
      y2: child.y + child.height / 2,
    });
  }

  const last = colWidth.length - 1;
  return {
    nodes,
    edges,
    width: last < 0 ? 0 : colX[last] + colWidth[last],
    height: cursor === 0 ? 0 : cursor - rowGap,
  };
}

/** Where the virtual root's right edge meets its children: middle of first and last root. */
export function rootAnchor(layout: TreeLayout): number {
  const roots = layout.nodes.filter((p) => p.parentKey === null);
  if (roots.length === 0) return 0;
  const c = (p: PlacedNode) => p.y + p.height / 2;
  return (c(roots[0]) + c(roots[roots.length - 1])) / 2;
}

/** Keys of `key`'s ancestors and of `key` itself (path keys are `a/b/c`). */
export function lineageOf(key: string): Set<string> {
  const out = new Set<string>();
  const parts = key.split("/");
  for (let i = 1; i <= parts.length; i++) out.add(parts.slice(0, i).join("/"));
  return out;
}

/** True when `key` is `focus`, one of its ancestors, or one of its descendants. */
export function inLineage(key: string, focus: string): boolean {
  return key === focus || focus.startsWith(`${key}/`) || key.startsWith(`${focus}/`);
}

/** Goals, projects and tasks anywhere under `n` (collapsed or not). */
export function subtreeCounts(n: RoadmapNode): Record<"goal" | "project" | "task", number> {
  const out = { goal: 0, project: 0, task: 0 };
  const walk = (m: RoadmapNode) => {
    for (const c of m.children) {
      if (c.kind !== "area") out[c.kind]++;
      walk(c);
    }
  };
  walk(n);
  return out;
}

/** `2026-11-29` → `2026.11.29` (the app's date style); anything else is left as is. */
export function dotDate(s: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.replaceAll("-", ".") : s;
}

/** Cubic Bézier from (x1,y1) to (x2,y2) with horizontal tangents at both ends. */
export function edgePath(e: Pick<PlacedEdge, "x1" | "y1" | "x2" | "y2">): string {
  const mx = (e.x1 + e.x2) / 2;
  return `M${e.x1},${e.y1} C${mx},${e.y1} ${mx},${e.y2} ${e.x2},${e.y2}`;
}
