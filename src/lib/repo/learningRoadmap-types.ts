// Client-safe types for learning roadmaps (no db imports). Server code lives in
// `./learningRoadmap.ts`; UI components should import types from here. Unions come
// from the JSON contract (type-only import, so zod stays out of client bundles).

import type {
  NodeKind,
  NodeStatus,
  ResourceKind,
  RoadmapPriority,
} from "@/lib/roadmap/contract";

export type RoadmapNodeKind = NodeKind;
export type RoadmapNodePriority = RoadmapPriority;
export type RoadmapNodeStatus = NodeStatus;
export type RoadmapResourceKind = ResourceKind;

export const ROADMAP_NODE_STATUSES: readonly RoadmapNodeStatus[] = ["todo", "doing", "done"];

export interface RoadmapResourceView {
  title: string;
  url: string;
  kind: RoadmapResourceKind;
}

/** Done/total over items (stages excluded) in a subtree or a whole roadmap. */
export interface RoadmapProgress {
  done: number;
  total: number;
}

/** One node of a roadmap tree: a stage (top level) or an item (nested below a stage). */
export interface RoadmapNodeView {
  id: string;
  kind: RoadmapNodeKind;
  title: string;
  description: string;
  /** Null for stages. */
  priority: RoadmapNodePriority | null;
  resources: RoadmapResourceView[];
  status: RoadmapNodeStatus;
  /** Items below this node (all depths), not counting itself. */
  progress: RoadmapProgress;
  children: RoadmapNodeView[];
}

/** One roadmap with its stages (position order) and nested items. */
export interface RoadmapTree {
  id: string;
  slug: string;
  title: string;
  topic: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  progress: RoadmapProgress;
  stages: RoadmapNodeView[];
}

/** A row of the roadmap list (no nodes). */
export interface RoadmapSummary {
  id: string;
  slug: string;
  title: string;
  topic: string;
  summary: string;
  updatedAt: string;
  progress: RoadmapProgress;
}
