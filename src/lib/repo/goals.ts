import { and, asc, eq, inArray, isNull, or, type SQL } from "drizzle-orm";
import { goals, links, projects } from "@/db/schema";
import {
  GOAL_HORIZON,
  GOAL_PROGRESS_MODE,
  GOAL_STATUS,
  type GoalHorizon,
  type GoalProgressMode,
  type GoalStatus,
} from "@/lib/enums";
import { isAssignable as isAssignableArea } from "./areas";
import { getHeads, refKey } from "./items";
import { removeLinksFor } from "./links";
import {
  archiveFilter,
  db,
  definedOnly,
  hasTag,
  newId,
  nowIso,
  RepoError,
  requireEnum,
  requireTitle,
  trimText,
  withTx,
  type ArchiveOptions,
  type Executor,
  type ItemRef,
} from "./shared";
import { getTagsFor, removeTagsFor, setTagsWith } from "./tags";

export type Goal = typeof goals.$inferSelect & { tags: string[] };

export type GoalInput = {
  title: string;
  /** Default "quarter". */
  horizon?: GoalHorizon;
  /** `2027` for year goals, `2027-Q1` for quarter goals; ignored (null) for life goals. */
  period?: string | null;
  /** Year goal → life goal, quarter goal → year goal; `null` clears it. */
  parentId?: string | null;
  areaId?: string | null;
  why?: string;
  status?: GoalStatus;
  progressMode?: GoalProgressMode;
  /** 0..100 (manual mode); `null` clears it. */
  manualProgress?: number | null;
  body?: string;
  tags?: string[];
};
export type GoalPatch = Partial<GoalInput>;

export type GoalListOptions = ArchiveOptions & {
  horizon?: GoalHorizon;
  areaId?: string;
  parentId?: string;
  tag?: string;
};

const ref = (id: string) => ({ type: "goal" as const, id });

/** The horizon a parent must have; life goals have no parent. */
export const PARENT_HORIZON: Record<GoalHorizon, GoalHorizon | null> = {
  life: null,
  year: "life",
  quarter: "year",
};

const PERIOD_RE: Record<GoalHorizon, RegExp | null> = {
  life: null,
  year: /^\d{4}$/,
  quarter: /^\d{4}-Q[1-4]$/,
};

/** Valid period for the horizon (pure; exported for tests). Life goals → null. */
export function normalizePeriod(horizon: GoalHorizon, period: unknown): string | null {
  if (horizon === "life") return null;
  const value = typeof period === "string" ? period.trim().toUpperCase() : "";
  if (!PERIOD_RE[horizon]!.test(value)) {
    throw new RepoError(
      "invalid",
      horizon === "year"
        ? "연 목표의 기간은 2027처럼 연도로 입력하세요."
        : "분기 목표의 기간은 2027-Q1처럼 입력하세요.",
    );
  }
  return value;
}

/** Period for "now", e.g. new goals: `2026` / `2026-Q4`. */
export function currentPeriod(horizon: GoalHorizon, now = new Date()): string | null {
  if (horizon === "life") return null;
  const year = String(now.getFullYear());
  return horizon === "year" ? year : `${year}-Q${Math.floor(now.getMonth() / 3) + 1}`;
}

function requireProgress(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100) {
    throw new RepoError("invalid", "진행률은 0에서 100 사이로 입력하세요.");
  }
  return value;
}

async function withTags(rows: (typeof goals.$inferSelect)[], exec: Executor = db()) {
  const tagMap = await getTagsFor(
    "goal",
    rows.map((r) => r.id),
    exec,
  );
  return rows.map((r) => ({ ...r, tags: tagMap.get(r.id) ?? [] }));
}

function toColumns(input: GoalPatch) {
  return definedOnly({
    title: input.title === undefined ? undefined : requireTitle(input.title),
    why: input.why === undefined ? undefined : trimText(input.why),
    status: input.status === undefined ? undefined : requireEnum(GOAL_STATUS, input.status, "상태"),
    progressMode:
      input.progressMode === undefined
        ? undefined
        : requireEnum(GOAL_PROGRESS_MODE, input.progressMode, "진행률 방식"),
    manualProgress:
      input.manualProgress === undefined ? undefined : requireProgress(input.manualProgress),
    body: input.body,
  });
}

const blankToNull = (v: string | null | undefined) => (v === "" ? null : v);

/**
 * Checks horizon/period/parent together (the merged state of an update). The parent
 * must exist, have the horizon one step up and not be archived — unless it is the
 * goal's current parent, which may stay even if it was archived later.
 */
async function validateShape(
  exec: Executor,
  state: {
    horizon: GoalHorizon;
    period: string | null;
    parentId: string | null;
    areaId: string | null;
  },
  current: { parentId: string | null; areaId: string | null } | null,
) {
  const wanted = PARENT_HORIZON[state.horizon];
  if (state.parentId !== null) {
    if (wanted === null) throw new RepoError("invalid", "인생 목표에는 상위 목표가 없습니다.");
    const [parent] = await exec
      .select({ horizon: goals.horizon, period: goals.period, archivedAt: goals.archivedAt })
      .from(goals)
      .where(eq(goals.id, state.parentId));
    if (!parent || (parent.archivedAt && current?.parentId !== state.parentId)) {
      throw new RepoError("not_found", "상위 목표를 찾을 수 없습니다.");
    }
    if (parent.horizon !== wanted) {
      throw new RepoError(
        "invalid",
        state.horizon === "year"
          ? "연 목표의 상위 목표는 인생 목표여야 합니다."
          : "분기 목표의 상위 목표는 연 목표여야 합니다.",
      );
    }
    if (state.horizon === "quarter" && !state.period?.startsWith(`${parent.period}-`)) {
      throw new RepoError(
        "invalid",
        `분기 목표의 연도는 상위 연 목표(${parent.period})와 같아야 합니다.`,
      );
    }
  }
  if (
    state.areaId !== null &&
    current?.areaId !== state.areaId &&
    !(await isAssignableArea(state.areaId, exec))
  ) {
    throw new RepoError("not_found", "영역을 찾을 수 없습니다.");
  }
}

const HORIZON_ORDER: Record<GoalHorizon, number> = { life: 0, year: 1, quarter: 2 };

function sortGoals<T extends { horizon: GoalHorizon; period: string | null; title: string }>(
  rows: T[],
): T[] {
  return rows.sort(
    (a, b) =>
      HORIZON_ORDER[a.horizon] - HORIZON_ORDER[b.horizon] ||
      (a.period ?? "").localeCompare(b.period ?? "") ||
      a.title.localeCompare(b.title, "ko"),
  );
}

/** Non-archived goals by default, life → year → quarter, then period and title. */
export async function list(options: GoalListOptions = {}): Promise<Goal[]> {
  const where: (SQL | undefined)[] = [archiveFilter(goals.archivedAt, options)];
  if (options.horizon) where.push(eq(goals.horizon, options.horizon));
  if (options.areaId) where.push(eq(goals.areaId, options.areaId));
  if (options.parentId) where.push(eq(goals.parentId, options.parentId));
  if (options.tag) where.push(hasTag(db(), "goal", goals.id, options.tag));
  const rows = await db()
    .select()
    .from(goals)
    .where(and(...where))
    .orderBy(asc(goals.period), asc(goals.title));
  return withTags(sortGoals(rows));
}

export async function get(id: string): Promise<Goal | null> {
  const [row] = await db().select().from(goals).where(eq(goals.id, id));
  return row ? (await withTags([row]))[0] : null;
}

export async function create(input: GoalInput): Promise<Goal> {
  const now = nowIso();
  const id = newId();
  const horizon = requireEnum(GOAL_HORIZON, input.horizon ?? "quarter", "기간 단위");
  const period = normalizePeriod(horizon, input.period ?? currentPeriod(horizon));
  const parentId = blankToNull(input.parentId) ?? null;
  const areaId = blankToNull(input.areaId) ?? null;
  const columns = toColumns({ ...input, title: undefined });
  await withTx(async (tx) => {
    await validateShape(tx, { horizon, period, parentId, areaId }, null);
    await tx.insert(goals).values({
      id,
      title: requireTitle(input.title),
      ...columns,
      horizon,
      period,
      parentId,
      areaId,
      createdAt: now,
      updatedAt: now,
    });
    if (input.tags) await setTagsWith(tx, ref(id), input.tags);
  });
  return (await get(id))!;
}

/**
 * Patch update. Changing the horizon needs a period that fits it (sent in the same
 * patch, or the current one if it already fits) and is refused while the goal has
 * child goals, since they would no longer fit under it.
 */
export async function update(id: string, patch: GoalPatch): Promise<Goal | null> {
  const columns = toColumns(patch);
  const found = await withTx(async (tx) => {
    const [current] = await tx.select().from(goals).where(eq(goals.id, id));
    if (!current) return false;
    const horizon =
      patch.horizon === undefined
        ? current.horizon
        : requireEnum(GOAL_HORIZON, patch.horizon, "기간 단위");
    if (horizon !== current.horizon) {
      const [child] = await tx
        .select({ id: goals.id })
        .from(goals)
        .where(eq(goals.parentId, id))
        .limit(1);
      if (child) {
        throw new RepoError("invalid", "하위 목표가 있으면 기간 단위를 바꿀 수 없습니다.");
      }
    }
    const period =
      patch.period !== undefined || horizon !== current.horizon
        ? normalizePeriod(horizon, patch.period === undefined ? current.period : patch.period)
        : current.period;
    const parentId =
      patch.parentId === undefined ? current.parentId : (blankToNull(patch.parentId) ?? null);
    if (parentId === id) throw new RepoError("invalid", "자기 자신을 상위 목표로 둘 수 없습니다.");
    const areaId =
      patch.areaId === undefined ? current.areaId : (blankToNull(patch.areaId) ?? null);
    await validateShape(tx, { horizon, period, parentId, areaId }, current);
    if (horizon === "year" && period !== current.period) {
      // Child quarter goals carry the year in their period.
      const [child] = await tx
        .select({ id: goals.id })
        .from(goals)
        .where(eq(goals.parentId, id))
        .limit(1);
      if (child) {
        throw new RepoError("invalid", "하위 분기 목표가 있으면 연도를 바꿀 수 없습니다.");
      }
    }
    await tx
      .update(goals)
      .set({ ...columns, horizon, period, parentId, areaId, updatedAt: nowIso() })
      .where(eq(goals.id, id));
    if (patch.tags) await setTagsWith(tx, ref(id), patch.tags);
    return true;
  });
  return found ? get(id) : null;
}

/** Deletes the goal: child goals and projects stay but lose it; links and tags go. */
export async function remove(id: string): Promise<boolean> {
  return withTx(async (tx) => {
    const deleted = await tx.delete(goals).where(eq(goals.id, id)).returning({ id: goals.id });
    if (!deleted.length) return false;
    // The FKs do this too; explicit so it holds even where FKs are off.
    await tx.update(goals).set({ parentId: null }).where(eq(goals.parentId, id));
    await tx.update(projects).set({ goalId: null }).where(eq(projects.goalId, id));
    await removeLinksFor(tx, ref(id));
    await removeTagsFor(tx, ref(id));
    return true;
  });
}

/** True when the goal exists and is not archived (for assigning projects). */
export async function isAssignable(id: string, exec: Executor = db()): Promise<boolean> {
  const rows = await exec
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.id, id), isNull(goals.archivedAt)))
    .limit(1);
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Tree and progress

export type GoalProject = {
  id: string;
  title: string;
  done: boolean;
  /** Papers and seminars linked to the project (the goal map's "자료" count). */
  resourceCount: number;
};

export type GoalNode = {
  goal: Goal;
  /** 0..100, or null (life goals, or nothing to measure yet). */
  progress: number | null;
  children: GoalNode[];
  projects: GoalProject[];
};

type ProgressInput = {
  horizon: GoalHorizon;
  status: GoalStatus;
  progressMode: GoalProgressMode;
  manualProgress: number | null;
};

/**
 * Progress rule (pure; exported for tests):
 * - life: none (direction only).
 * - achieved: 100. Manual mode: `manualProgress`.
 * - quarter (auto): share of linked projects that are done; no projects → manual value.
 * - year (auto): average of child goals that have a value (dropped ones left out);
 *   none → manual value.
 */
export function computeProgress(
  goal: ProgressInput,
  projectsDone: readonly boolean[],
  children: readonly { status: GoalStatus; progress: number | null }[],
): number | null {
  if (goal.horizon === "life") return null;
  if (goal.status === "achieved") return 100;
  if (goal.progressMode === "manual") return goal.manualProgress;
  if (goal.horizon === "quarter") {
    if (!projectsDone.length) return goal.manualProgress;
    return Math.round((projectsDone.filter(Boolean).length / projectsDone.length) * 100);
  }
  const values = children
    .filter((c) => c.status !== "dropped" && c.progress !== null)
    .map((c) => c.progress!);
  if (!values.length) return goal.manualProgress;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

async function projectsByGoal(goalIds: string[]): Promise<Map<string, GoalProject[]>> {
  const out = new Map<string, GoalProject[]>();
  if (!goalIds.length) return out;
  const rows = await db()
    .select({
      id: projects.id,
      title: projects.title,
      status: projects.status,
      goalId: projects.goalId,
    })
    .from(projects)
    .where(and(inArray(projects.goalId, goalIds), isNull(projects.archivedAt)))
    .orderBy(asc(projects.title));
  const counts = await resourceCounts(rows.map((r) => r.id));
  for (const r of rows) {
    const list = out.get(r.goalId!) ?? [];
    list.push({
      id: r.id,
      title: r.title,
      done: r.status === "done",
      resourceCount: counts.get(r.id) ?? 0,
    });
    out.set(r.goalId!, list);
  }
  return out;
}

/** Linked papers and seminars per project (either link direction). */
async function resourceCounts(projectIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!projectIds.length) return out;
  const rows = await db()
    .select()
    .from(links)
    .where(
      or(
        and(eq(links.sourceType, "project"), inArray(links.sourceId, projectIds)),
        and(eq(links.targetType, "project"), inArray(links.targetId, projectIds)),
      ),
    );
  const isResource = (t: string) => t === "paper" || t === "seminar";
  const pairs: { project: string; resource: ItemRef }[] = [];
  for (const l of rows) {
    if (l.sourceType === "project" && isResource(l.targetType)) {
      pairs.push({ project: l.sourceId, resource: { type: l.targetType, id: l.targetId } });
    } else if (l.targetType === "project" && isResource(l.sourceType)) {
      pairs.push({ project: l.targetId, resource: { type: l.sourceType, id: l.sourceId } });
    }
  }
  // Archived papers and seminars don't count.
  const heads = await getHeads(pairs.map((p) => p.resource));
  for (const p of pairs) {
    const head = heads.get(refKey(p.resource));
    if (head && !head.archived) out.set(p.project, (out.get(p.project) ?? 0) + 1);
  }
  return out;
}

/**
 * Goals as a forest: life goals first, then year and quarter goals whose parent is
 * missing (none, or hidden because archived). Children keep the list order.
 * Archived goals are left out by default.
 */
export async function listTree(options: ArchiveOptions = {}): Promise<GoalNode[]> {
  const all = await list(options);
  const byProject = await projectsByGoal(all.map((g) => g.id));
  const ids = new Set(all.map((g) => g.id));
  const childrenOf = new Map<string, Goal[]>();
  const roots: Goal[] = [];
  for (const g of all) {
    if (g.parentId && ids.has(g.parentId)) {
      childrenOf.set(g.parentId, [...(childrenOf.get(g.parentId) ?? []), g]);
    } else {
      roots.push(g);
    }
  }
  const build = (goal: Goal): GoalNode => {
    const children = (childrenOf.get(goal.id) ?? []).map(build);
    const goalProjects = byProject.get(goal.id) ?? [];
    return {
      goal,
      children,
      projects: goalProjects,
      progress: computeProgress(
        goal,
        goalProjects.map((p) => p.done),
        children.map((c) => ({ status: c.goal.status, progress: c.progress })),
      ),
    };
  };
  return roots.map(build);
}

/** One goal with its subtree and progress (detail page); null if not found. */
export async function getNode(id: string): Promise<GoalNode | null> {
  const goal = await get(id);
  if (!goal) return null;
  const find = (nodes: GoalNode[]): GoalNode | null => {
    for (const n of nodes) {
      if (n.goal.id === id) return n;
      const hit = find(n.children);
      if (hit) return hit;
    }
    return null;
  };
  // Archived goals are left out of the tree; an archived goal's own page still
  // shows its subtree (archived children included).
  return find(await listTree()) ?? find(await listTree({ includeArchived: true }));
}

function collectProgress(nodes: GoalNode[], out: Map<string, number | null>) {
  for (const n of nodes) {
    if (!out.has(n.goal.id)) out.set(n.goal.id, n.progress);
    collectProgress(n.children, out);
  }
}

/**
 * Progress (0..100 or null) of the given goals, by the rule in {@link computeProgress};
 * without `ids`, every non-archived goal. Unknown ids are left out. Archived goals are
 * computed only when asked for by id (their archived children then count too).
 */
export async function progressFor(ids?: readonly string[]): Promise<Record<string, number | null>> {
  const all = new Map<string, number | null>();
  collectProgress(await listTree(), all);
  if (ids && ids.some((id) => !all.has(id))) {
    const archived = new Map<string, number | null>();
    collectProgress(await listTree({ includeArchived: true }), archived);
    for (const [id, p] of archived) if (!all.has(id)) all.set(id, p);
  }
  const wanted = ids ?? [...all.keys()];
  return Object.fromEntries(wanted.filter((id) => all.has(id)).map((id) => [id, all.get(id)!]));
}
