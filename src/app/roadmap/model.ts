// Screen-side model for the learning roadmap. Types mirror the import contract; pure helpers
// (progress, side split) are unit-tested in tests/unit/learning-roadmap-model.test.ts.

export const PRIORITIES = ["required", "recommended", "optional"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const STATUSES = ["todo", "doing", "done"] as const;
export type Status = (typeof STATUSES)[number];

export const PRIORITY_LABEL: Record<Priority, string> = {
  required: "필수",
  recommended: "추천",
  optional: "선택",
};

export const STATUS_LABEL: Record<Status, string> = {
  todo: "할 일",
  doing: "진행 중",
  done: "완료",
};

export interface RoadmapResource {
  title: string;
  url: string;
  kind: string;
}

export interface RoadmapItem {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  status: Status;
  resources: RoadmapResource[];
  children: RoadmapItem[];
}

export interface RoadmapStage {
  id: string;
  title: string;
  description: string | null;
  items: RoadmapItem[];
}

export interface LearningRoadmap {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  stages: RoadmapStage[];
}

export interface Progress {
  done: number;
  total: number;
}

/** Every item in the tree, depth first (parents before their children). */
export function flatten(items: RoadmapItem[]): RoadmapItem[] {
  return items.flatMap((i) => [i, ...flatten(i.children)]);
}

export function progressOf(items: RoadmapItem[]): Progress {
  const all = flatten(items);
  return { done: all.filter((i) => i.status === "done").length, total: all.length };
}

export const ratio = (p: Progress) => (p.total === 0 ? 0 : p.done / p.total);

/** Stage status: done when every item is done, doing once anything started, else todo. */
export function stageStatus(items: RoadmapItem[]): Status {
  const all = flatten(items);
  if (all.length > 0 && all.every((i) => i.status === "done")) return "done";
  return all.some((i) => i.status !== "todo") ? "doing" : "todo";
}

/** Splits a stage's items for the two sides of the stem: first half left, rest right. */
export function splitSides<T>(items: T[]): { left: T[]; right: T[] } {
  const half = Math.ceil(items.length / 2);
  return { left: items.slice(0, half), right: items.slice(half) };
}

export function findItem(roadmap: LearningRoadmap, id: string): RoadmapItem | undefined {
  return roadmap.stages.flatMap((s) => flatten(s.items)).find((i) => i.id === id);
}
