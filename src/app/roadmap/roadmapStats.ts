/**
 * Pure data helpers for the roadmap view: counts, progress, labels, dates and the
 * hover-highlight relatives. Reads `RoadmapNode` as-is; never changes its shape.
 */
import { formatDate } from "@/components/ui/format";
import { GOAL_STATUS, PROJECT_STATUS } from "@/lib/enums";
import type { RoadmapNode } from "@/lib/repo/roadmap-types";
import { nodeId } from "./roadmapLayout";

export interface RoadmapCounts {
  /** All goals below the node (any depth), not counting the node itself. */
  goals: number;
  /** All projects below the node (any depth). */
  projects: number;
  /** All tasks below the node (any depth). */
  tasks: number;
}

/** Descendant counts by kind (the node itself is not counted). */
export function countDescendants(node: RoadmapNode): RoadmapCounts {
  const out: RoadmapCounts = { goals: 0, projects: 0, tasks: 0 };
  const walk = (n: RoadmapNode) => {
    for (const c of n.children) {
      if (c.kind === "goal") out.goals++;
      else if (c.kind === "project") out.projects++;
      else if (c.kind === "task") out.tasks++;
      walk(c);
    }
  };
  walk(node);
  return out;
}

/** `countDescendants` for every area/goal/project in the forest, keyed by `nodeId`. */
export function countAll(roots: readonly RoadmapNode[]): Map<string, RoadmapCounts> {
  const out = new Map<string, RoadmapCounts>();
  const walk = (n: RoadmapNode) => {
    if (n.kind !== "task") out.set(nodeId(n), countDescendants(n));
    n.children.forEach(walk);
  };
  roots.forEach(walk);
  return out;
}

const clampPct = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 100);

/**
 * Goal/project progress as 0..100, or null when there is nothing to measure.
 * Uses the node's own `progress` (0..1) when set; otherwise the share of done tasks
 * among its direct and nested tasks. Areas and tasks give null.
 */
export function progressPercent(node: RoadmapNode): number | null {
  if (node.kind !== "goal" && node.kind !== "project") return null;
  if (node.progress !== null && Number.isFinite(node.progress)) return clampPct(node.progress);
  let total = 0;
  let done = 0;
  const walk = (n: RoadmapNode) => {
    for (const c of n.children) {
      if (c.kind === "task") {
        total++;
        if (c.done) done++;
      }
      walk(c);
    }
  };
  walk(node);
  return total ? clampPct(done / total) : null;
}

/** Korean label for a project status (`계획`/`진행 중`/`완료`/`보류`); unknown → as-is, null → "". */
export function projectStatusLabel(status: string | null | undefined): string {
  if (!status) return "";
  return PROJECT_STATUS.label(status as never);
}

/** Korean label for a goal status (`진행 중`/`달성`/`내려놓음`); unknown → as-is, null → "". */
export function goalStatusLabel(status: string | null | undefined): string {
  if (!status) return "";
  return GOAL_STATUS.label(status as never);
}

/** Status label by node kind (project/goal); other kinds give "". */
export function statusLabel(node: Pick<RoadmapNode, "kind" | "status">): string {
  if (node.kind === "project") return projectStatusLabel(node.status);
  if (node.kind === "goal") return goalStatusLabel(node.status);
  return "";
}

/**
 * `YYYY.MM.DD` for a date / ISO timestamp (via the app's `formatDate`). Period labels
 * that are not dates (goal `2027`, `2027-Q1`) pass through unchanged. Empty → "".
 */
export function formatRoadmapDate(value: string | null | undefined): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return formatDate(value) || value;
  return value;
}

export interface Relatives {
  ancestors: Set<string>;
  descendants: Set<string>;
}

/**
 * For every node (`nodeId`): the ids of all its ancestors and all its descendants.
 * If a node appears under more than one parent, the sets are merged.
 */
export function relativesIndex(roots: readonly RoadmapNode[]): Map<string, Relatives> {
  const out = new Map<string, Relatives>();
  const get = (id: string) => {
    let r = out.get(id);
    if (!r) {
      r = { ancestors: new Set(), descendants: new Set() };
      out.set(id, r);
    }
    return r;
  };
  // Returns the ids of the subtree below n.
  const walk = (n: RoadmapNode, path: string[]): string[] => {
    const id = nodeId(n);
    const rel = get(id);
    path.forEach((a) => rel.ancestors.add(a));
    const below: string[] = [];
    path.push(id);
    for (const c of n.children) below.push(nodeId(c), ...walk(c, path));
    path.pop();
    below.forEach((d) => rel.descendants.add(d));
    return below;
  };
  roots.forEach((r) => walk(r, []));
  return out;
}

/** Ids to highlight when hovering `id`: itself, its ancestors and its descendants. */
export function highlightSet(index: ReadonlyMap<string, Relatives>, id: string): Set<string> {
  const rel = index.get(id);
  const out = new Set<string>([id]);
  rel?.ancestors.forEach((a) => out.add(a));
  rel?.descendants.forEach((d) => out.add(d));
  return out;
}
