import type { RoadmapNode } from "@/lib/repo/roadmap-types";

/** Box size and spacing, in layout px (before zoom). */
export interface LayoutSize {
  nodeWidth: number;
  nodeHeight: number;
  /** Horizontal gap between a column and the next (room for the curved edges). */
  colGap: number;
  /** Vertical gap between stacked boxes. */
  rowGap: number;
}

export const DEFAULT_SIZE: LayoutSize = { nodeWidth: 232, nodeHeight: 56, colGap: 72, rowGap: 12 };

export interface PlacedNode {
  /** Path from the root (`goal-1/project-2`): unique even if a node shows up twice. */
  key: string;
  /** `kind-id`: the collapse key and the test id suffix. */
  id: string;
  node: RoadmapNode;
  depth: number;
  /** Top-left corner of the box. */
  x: number;
  y: number;
  parentKey: string | null;
  collapsed: boolean;
}

export interface PlacedEdge {
  key: string;
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
 * Left-to-right tidy tree. Each depth is a column; visible leaves stack top to bottom in
 * order, and every parent sits at the vertical middle of its first and last child. A
 * subtree therefore owns a contiguous band of rows, so boxes never overlap. Children of a
 * collapsed node are left out. The roots hang off an implicit virtual root (not drawn).
 */
export function layoutTree(
  roots: readonly RoadmapNode[],
  collapsed: ReadonlySet<string>,
  size: LayoutSize = DEFAULT_SIZE,
): TreeLayout {
  const { nodeWidth, nodeHeight, colGap, rowGap } = size;
  const nodes: PlacedNode[] = [];
  let cursor = 0; // top of the next free row
  let maxDepth = -1;

  // Returns the placed node's centre y.
  const place = (n: RoadmapNode, depth: number, parent: PlacedNode | null): number => {
    const id = nodeId(n);
    const key = parent ? `${parent.key}/${id}` : id;
    const isCollapsed = collapsed.has(id) && n.children.length > 0;
    const placed: PlacedNode = {
      key,
      id,
      node: n,
      depth,
      x: depth * (nodeWidth + colGap),
      y: 0,
      parentKey: parent?.key ?? null,
      collapsed: isCollapsed,
    };
    nodes.push(placed);
    maxDepth = Math.max(maxDepth, depth);

    const kids = isCollapsed ? [] : n.children;
    if (kids.length === 0) {
      placed.y = cursor;
      cursor += nodeHeight + rowGap;
    } else {
      const centres = kids.map((c) => place(c, depth + 1, placed));
      placed.y = (centres[0] + centres[centres.length - 1]) / 2 - nodeHeight / 2;
    }
    return placed.y + nodeHeight / 2;
  };

  roots.forEach((r) => place(r, 0, null));

  const byKey = new Map(nodes.map((p) => [p.key, p]));
  const edges: PlacedEdge[] = [];
  for (const child of nodes) {
    if (child.parentKey === null) continue;
    const parent = byKey.get(child.parentKey)!;
    edges.push({
      key: child.key,
      x1: parent.x + nodeWidth,
      y1: parent.y + nodeHeight / 2,
      x2: child.x,
      y2: child.y + nodeHeight / 2,
    });
  }

  return {
    nodes,
    edges,
    width: maxDepth < 0 ? 0 : (maxDepth + 1) * nodeWidth + maxDepth * colGap,
    height: cursor === 0 ? 0 : cursor - rowGap,
  };
}

/** Cubic Bézier from (x1,y1) to (x2,y2) with horizontal tangents at both ends. */
export function edgePath(e: Pick<PlacedEdge, "x1" | "y1" | "x2" | "y2">): string {
  const mx = (e.x1 + e.x2) / 2;
  return `M${e.x1},${e.y1} C${mx},${e.y1} ${mx},${e.y2} ${e.x2},${e.y2}`;
}
