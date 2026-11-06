// Screen-side model for the learning roadmap: re-exports the repo's client-safe view types
// plus labels and a few pure helpers (tests/unit/learning-roadmap-model.test.ts).
import {
  ROADMAP_NODE_STATUSES,
  type RoadmapNodePriority,
  type RoadmapNodeStatus,
  type RoadmapNodeView,
  type RoadmapProgress,
  type RoadmapTree,
} from "@/lib/repo/learningRoadmap-types";

export type {
  RoadmapNodePriority as Priority,
  RoadmapNodeStatus as Status,
  RoadmapNodeView as RoadmapNode,
  RoadmapNodeView as RoadmapItem,
  RoadmapProgress as Progress,
  RoadmapResourceView as RoadmapResource,
  RoadmapSummary,
  RoadmapTree as LearningRoadmap,
} from "@/lib/repo/learningRoadmap-types";

export const PRIORITIES: readonly RoadmapNodePriority[] = ["essential", "recommended", "optional"];

export const STATUSES = ROADMAP_NODE_STATUSES;

export const PRIORITY_LABEL: Record<RoadmapNodePriority, string> = {
  essential: "필수",
  recommended: "추천",
  optional: "선택",
};

export const STATUS_LABEL: Record<RoadmapNodeStatus, string> = {
  todo: "할 일",
  doing: "진행 중",
  done: "완료",
};

/** Every node in the subtrees, depth first (parents before their children). */
export function flatten(nodes: RoadmapNodeView[]): RoadmapNodeView[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}

export const ratio = (p: RoadmapProgress) => (p.total === 0 ? 0 : p.done / p.total);

/** Stage status from its items: done when all are done, doing once any started, else todo. */
export function stageStatus(stage: RoadmapNodeView): RoadmapNodeStatus {
  const all = flatten(stage.children);
  if (all.length > 0 && all.every((i) => i.status === "done")) return "done";
  return all.some((i) => i.status !== "todo") ? "doing" : "todo";
}

/** Splits a stage's items for the two sides of the stem: first half left, rest right. */
export function splitSides<T>(items: T[]): { left: T[]; right: T[] } {
  const half = Math.ceil(items.length / 2);
  return { left: items.slice(0, half), right: items.slice(half) };
}

export function findNode(roadmap: RoadmapTree, id: string): RoadmapNodeView | undefined {
  return flatten(roadmap.stages).find((n) => n.id === id);
}

/** A row the tree currently shows; `level` is 1 for stages (aria-level), max 4. */
export interface VisibleNode {
  node: RoadmapNodeView;
  id: string;
  level: number;
  parentId: string | null;
  /** 1-based position among siblings, and the sibling count (aria-posinset / aria-setsize). */
  posInSet: number;
  setSize: number;
  hasChildren: boolean;
  expanded: boolean;
  /** 0-based index of the stage this row belongs to. */
  stageIndex: number;
}

/**
 * Rows in display order (depth first), walking only into unfolded nodes, so the cost is the
 * number of visible rows, not the 1000 nodes. Keyboard navigation moves along this list.
 */
export function visibleNodes(
  stages: RoadmapNodeView[],
  collapsed: ReadonlySet<string>,
): VisibleNode[] {
  const out: VisibleNode[] = [];
  const walk = (nodes: RoadmapNodeView[], level: number, parentId: string | null, stageIndex: number) => {
    nodes.forEach((node, i) => {
      const hasChildren = node.children.length > 0;
      const open = hasChildren && !collapsed.has(node.id);
      const si = level === 1 ? i : stageIndex;
      out.push({
        node,
        id: node.id,
        level,
        parentId,
        posInSet: i + 1,
        setSize: nodes.length,
        hasChildren,
        expanded: open,
        stageIndex: si,
      });
      if (open) walk(node.children, level + 1, node.id, si);
    });
  };
  walk(stages, 1, null, 0);
  return out;
}

/** Parent id of every node (stages map to null); build once per roadmap. */
export function parentIndex(stages: RoadmapNodeView[]): Map<string, string | null> {
  const out = new Map<string, string | null>();
  const walk = (nodes: RoadmapNodeView[], parent: string | null) => {
    for (const n of nodes) {
      out.set(n.id, parent);
      walk(n.children, n.id);
    }
  };
  walk(stages, null);
  return out;
}

/** Done/total per stage plus the whole roadmap, from the server-computed progress. */
export function stageProgress(roadmap: RoadmapTree): {
  stages: { id: string; done: number; total: number; ratio: number }[];
  overall: RoadmapProgress & { ratio: number };
} {
  return {
    stages: roadmap.stages.map((s) => ({ id: s.id, ...s.progress, ratio: ratio(s.progress) })),
    overall: { ...roadmap.progress, ratio: ratio(roadmap.progress) },
  };
}
