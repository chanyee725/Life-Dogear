import { and, asc, eq, isNull } from "drizzle-orm";
import { areas, goals, projects, tasks } from "@/db/schema";
import { itemPath } from "@/lib/item-path";
import { progressFor } from "./goals";
import { db } from "./shared";
import type { RoadmapData, RoadmapNode } from "./roadmap-types";

export type { RoadmapData, RoadmapNode } from "./roadmap-types";

/** Id and title of the virtual area node for goals and projects without an area. */
export const NO_AREA_ID = "none";
export const NO_AREA_TITLE = "영역 없음";

export type RoadmapOptions = {
  /** Also show achieved/dropped goals, done projects and done tasks. Archived stay out. */
  includeDone?: boolean;
};

type AreaRow = { id: string; title: string };
type GoalRow = {
  id: string;
  title: string;
  parentId: string | null;
  areaId: string | null;
  status: string;
  period: string | null;
  /** 0..100 or null, as on `/goals`. */
  progress: number | null;
};
type ProjectRow = {
  id: string;
  title: string;
  goalId: string | null;
  areaId: string | null;
  status: string;
  dueDate: string | null;
};
type TaskRow = {
  id: string;
  title: string;
  parentId: string;
  done: boolean;
  dueDate: string | null;
  sortOrder: number;
};

export type RoadmapRows = {
  /** Non-archived areas, in display order. */
  areas: AreaRow[];
  /** Non-archived goals, in display order (life → year → quarter). */
  goals: GoalRow[];
  /** Non-archived projects, in display order. */
  projects: ProjectRow[];
  /** Tasks whose parent is a project. */
  tasks: TaskRow[];
};

const goalDone = (status: string) => status === "achieved" || status === "dropped";

/**
 * Area → goal (nested by `parentId`) → project → task, from plain rows (pure; exported
 * for tests).
 * - A goal sits under its parent goal when that is shown; otherwise under its area:
 *   its own, else the nearest ancestor's. Goals and projects without a (shown) area go
 *   to the virtual {@link NO_AREA_ID} area, last, only when it has children.
 * - A project sits under its goal when that is shown, else under its own area, else
 *   under the goal's area.
 * - Tasks follow `sortOrder`. Project progress: share of its tasks done (all of them,
 *   shown or not); a done project is 1.
 */
export function assembleRoadmap(rows: RoadmapRows, options: RoadmapOptions = {}): RoadmapData {
  const includeDone = options.includeDone ?? false;
  const goalById = new Map(rows.goals.map((g) => [g.id, g]));
  const areaIds = new Set(rows.areas.map((a) => a.id));

  const shownGoals = rows.goals.filter((g) => includeDone || !goalDone(g.status));
  const shownGoalIds = new Set(shownGoals.map((g) => g.id));

  /** Own area, else the nearest ancestor's (cycle-safe); null when none is shown. */
  const goalArea = (id: string | null): string | null => {
    const seen = new Set<string>();
    for (let g = id ? goalById.get(id) : undefined; g && !seen.has(g.id);) {
      seen.add(g.id);
      if (g.areaId) return areaIds.has(g.areaId) ? g.areaId : null;
      g = g.parentId ? goalById.get(g.parentId) : undefined;
    }
    return null;
  };
  /** Nearest shown ancestor goal. */
  const shownParent = (g: GoalRow): string | null => {
    const seen = new Set<string>([g.id]);
    for (let p = g.parentId; p && !seen.has(p); p = goalById.get(p)?.parentId ?? null) {
      if (shownGoalIds.has(p)) return p;
      seen.add(p);
    }
    return null;
  };

  const tasksByProject = new Map<string, TaskRow[]>();
  for (const t of rows.tasks) {
    tasksByProject.set(t.parentId, [...(tasksByProject.get(t.parentId) ?? []), t]);
  }

  const projectNode = (p: ProjectRow): RoadmapNode => {
    const href = itemPath("projects", p.id, p.title);
    const all = [...(tasksByProject.get(p.id) ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    const done = all.filter((t) => t.done).length;
    return {
      kind: "project",
      id: p.id,
      title: p.title,
      href,
      status: p.status,
      progress: p.status === "done" ? 1 : all.length ? done / all.length : null,
      due: p.dueDate,
      children: all
        .filter((t) => includeDone || !t.done)
        .map((t) => ({
          kind: "task",
          id: t.id,
          title: t.title,
          href,
          status: null,
          progress: null,
          due: t.dueDate,
          done: t.done,
          children: [],
        })),
    };
  };

  const goalChildren = new Map<string, RoadmapNode[]>();
  const areaChildren = new Map<string, RoadmapNode[]>();
  const push = (map: Map<string, RoadmapNode[]>, key: string, node: RoadmapNode) =>
    map.set(key, [...(map.get(key) ?? []), node]);

  const goalNodes = new Map<string, RoadmapNode>();
  for (const g of shownGoals) {
    goalNodes.set(g.id, {
      kind: "goal",
      id: g.id,
      title: g.title,
      href: itemPath("goals", g.id, g.title),
      status: g.status,
      progress: g.progress === null ? null : g.progress / 100,
      due: g.period,
      children: [],
    });
  }

  // Child goals first, then projects, each in list order.
  for (const g of shownGoals) {
    const parent = shownParent(g);
    if (parent) push(goalChildren, parent, goalNodes.get(g.id)!);
    else push(areaChildren, goalArea(g.id) ?? NO_AREA_ID, goalNodes.get(g.id)!);
  }
  for (const p of rows.projects) {
    if (!includeDone && p.status === "done") continue;
    const node = projectNode(p);
    if (p.goalId && shownGoalIds.has(p.goalId)) {
      push(goalChildren, p.goalId, node);
    } else {
      const area = p.areaId && areaIds.has(p.areaId) ? p.areaId : goalArea(p.goalId);
      push(areaChildren, area ?? NO_AREA_ID, node);
    }
  }
  for (const [id, node] of goalNodes) node.children = goalChildren.get(id) ?? [];

  const areaNode = (id: string, title: string, href: string | null): RoadmapNode => ({
    kind: "area",
    id,
    title,
    href,
    status: null,
    progress: null,
    due: null,
    children: areaChildren.get(id) ?? [],
  });
  const roots = rows.areas.map((a) => areaNode(a.id, a.title, itemPath("areas", a.id, a.title)));
  if (areaChildren.get(NO_AREA_ID)?.length) roots.push(areaNode(NO_AREA_ID, NO_AREA_TITLE, null));
  return { roots, includeDone };
}

/** Roadmap tree for `/roadmap` from the existing areas, goals, projects and tasks. */
export async function buildRoadmap(options: RoadmapOptions = {}): Promise<RoadmapData> {
  const exec = db();
  const [areaRows, goalRows, projectRows, taskRows, progress] = await Promise.all([
    exec
      .select({ id: areas.id, title: areas.title })
      .from(areas)
      .where(isNull(areas.archivedAt))
      .orderBy(asc(areas.sortOrder), asc(areas.title)),
    exec
      .select({
        id: goals.id,
        title: goals.title,
        parentId: goals.parentId,
        areaId: goals.areaId,
        status: goals.status,
        period: goals.period,
        horizon: goals.horizon,
      })
      .from(goals)
      .where(isNull(goals.archivedAt)),
    exec
      .select({
        id: projects.id,
        title: projects.title,
        goalId: projects.goalId,
        areaId: projects.areaId,
        status: projects.status,
        dueDate: projects.dueDate,
      })
      .from(projects)
      .where(isNull(projects.archivedAt))
      .orderBy(asc(projects.title)),
    exec
      .select({
        id: tasks.id,
        title: tasks.title,
        parentId: tasks.parentId,
        doneAt: tasks.doneAt,
        dueDate: tasks.dueDate,
        sortOrder: tasks.sortOrder,
      })
      .from(tasks)
      .where(and(eq(tasks.parentType, "project"), isNull(tasks.archivedAt))),
    progressFor(),
  ]);
  const horizonOrder: Record<string, number> = { life: 0, year: 1, quarter: 2 };
  goalRows.sort(
    (a, b) =>
      (horizonOrder[a.horizon] ?? 9) - (horizonOrder[b.horizon] ?? 9) ||
      (a.period ?? "").localeCompare(b.period ?? "") ||
      a.title.localeCompare(b.title, "ko"),
  );
  return assembleRoadmap(
    {
      areas: areaRows,
      goals: goalRows.map((g) => ({ ...g, progress: progress[g.id] ?? null })),
      projects: projectRows.sort((a, b) => a.title.localeCompare(b.title, "ko")),
      tasks: taskRows
        .filter((t): t is typeof t & { parentId: string } => t.parentId !== null)
        .map((t) => ({ ...t, done: t.doneAt !== null })),
    },
    options,
  );
}
