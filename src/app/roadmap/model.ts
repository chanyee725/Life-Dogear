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
