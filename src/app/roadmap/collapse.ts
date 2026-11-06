import type { RoadmapNode } from "@/lib/repo/roadmap-types";
import { nodeId } from "./roadmapLayout";

/**
 * Collapse state for the roadmap tree: a set of `nodeId` keys (`kind-id`, see layout.ts).
 * A key in the set means that node's children are hidden. The first-render default is
 * `defaultCollapsed` in layout.ts. Every function here returns a new set and never
 * mutates its input, so the result can go straight into React state.
 */
export type CollapsedSet = ReadonlySet<string>;

/** Flip one node: collapsed → open, open → collapsed. */
export function toggleCollapsed(collapsed: CollapsedSet, key: string): Set<string> {
  const next = new Set(collapsed);
  if (!next.delete(key)) next.add(key);
  return next;
}

/** 모두 펼치기: nothing collapsed. */
export function expandAll(): Set<string> {
  return new Set();
}

/** 모두 접기: every node with children collapsed, so only the roots stay visible. */
export function collapseAll(roots: readonly RoadmapNode[]): Set<string> {
  const out = new Set<string>();
  const walk = (n: RoadmapNode) => {
    if (n.children.length === 0) return;
    out.add(nodeId(n));
    n.children.forEach(walk);
  };
  roots.forEach(walk);
  return out;
}

/** True when nothing with children is collapsed (모두 펼치기 would change nothing). */
export function isAllExpanded(roots: readonly RoadmapNode[], collapsed: CollapsedSet): boolean {
  const walk = (n: RoadmapNode): boolean =>
    n.children.length === 0 || (!collapsed.has(nodeId(n)) && n.children.every(walk));
  return roots.every(walk);
}

/** True when every node with children is collapsed (모두 접기 would change nothing). */
export function isAllCollapsed(roots: readonly RoadmapNode[], collapsed: CollapsedSet): boolean {
  const walk = (n: RoadmapNode): boolean =>
    n.children.length === 0 || (collapsed.has(nodeId(n)) && n.children.every(walk));
  return roots.every(walk);
}

/**
 * The tree as drawn: a copy where collapsed nodes have no children. Nodes are copied
 * only along paths that change, so untouched subtrees keep their identity. Use the
 * original node's `children.length` for the "n개 숨김" count of a collapsed node.
 */
export function visibleTree(roots: readonly RoadmapNode[], collapsed: CollapsedSet): RoadmapNode[] {
  const prune = (n: RoadmapNode): RoadmapNode => {
    if (n.children.length === 0) return n;
    if (collapsed.has(nodeId(n))) return { ...n, children: [] };
    const kids = n.children.map(prune);
    return kids.every((k, i) => k === n.children[i]) ? n : { ...n, children: kids };
  };
  return roots.map(prune);
}
