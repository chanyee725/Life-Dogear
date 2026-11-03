/**
 * Tasks (할 일). A task belongs to a project, goal or area, or to nothing (the task inbox).
 * Tasks of an archived parent are hidden (computed at read time, nothing is written), and a
 * deleted parent takes its tasks along (`links.removeLinksFor`).
 */
import { and, asc, eq, gte, inArray, isNotNull, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { areas, goals, projects, tasks } from "@/db/schema";
import {
  db,
  newId,
  nowIso,
  optionalDate,
  RepoError,
  withTx,
  type Executor,
  type ItemRef,
} from "./shared";

export type TaskParentType = "project" | "goal" | "area";
export type TaskParent = { type: TaskParentType; id: string } | null;

export type Task = {
  id: string;
  title: string;
  doneAt: string | null;
  dueDate: string | null;
  parentType: TaskParentType | null;
  parentId: string | null;
  /** Title of the parent (absent for inbox tasks). */
  parentTitle?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type TaskListOptions = {
  /** `null` = inbox tasks only; omitted = every task. */
  parent?: TaskParent;
  /** true = done only, false = open only; omitted = both. */
  done?: boolean;
  /** Due strictly before this date (`YYYY-MM-DD`); tasks without a due date are left out. */
  dueBefore?: string;
  /** Due on or after this date; tasks without a due date are left out. */
  dueFrom?: string;
  /** Also list tasks whose parent is archived (hidden by default). */
  includeArchivedParents?: boolean;
};

export type TaskInput = { title: string; parent?: TaskParent; dueDate?: string | null };
export type TaskPatch = { title?: string; dueDate?: string | null; done?: boolean };

export const TITLE_MAX = 300;

const PARENT_TYPES = new Set<string>(["project", "goal", "area"]);

/** `"type:id"` key of a parent; `"inbox"` for no parent (the `countFor` key). */
export const parentKey = (parent: TaskParent): string =>
  parent ? `${parent.type}:${parent.id}` : "inbox";

function requireParent(parent: unknown): TaskParent {
  if (parent === null || parent === undefined) return null;
  const p = parent as { type?: unknown; id?: unknown };
  if (
    typeof p.type !== "string" ||
    !PARENT_TYPES.has(p.type) ||
    typeof p.id !== "string" ||
    !p.id
  ) {
    throw new RepoError("invalid", "잘못된 소속입니다.");
  }
  return { type: p.type as TaskParentType, id: p.id };
}

function requireTaskTitle(title: unknown): string {
  const value = typeof title === "string" ? title.replace(/\s+/g, " ").trim() : "";
  if (!value) throw new RepoError("invalid", "할 일을 입력하세요.");
  if (value.length > TITLE_MAX) {
    throw new RepoError("invalid", `할 일은 ${TITLE_MAX}자 이내로 입력하세요.`);
  }
  return value;
}

const parentWhere = (parent: TaskParent): SQL =>
  parent
    ? and(eq(tasks.parentType, parent.type), eq(tasks.parentId, parent.id))!
    : and(isNull(tasks.parentType), isNull(tasks.parentId))!;

const byParent = (
  type: TaskParentType,
  id: typeof projects.id | typeof goals.id | typeof areas.id,
) => and(eq(tasks.parentType, type), eq(tasks.parentId, id));

/** Select with the parent's title and archived flag (one query, three left joins). */
function selectWithParent(exec: Executor) {
  return exec
    .select({
      task: tasks,
      parentTitle: sql<string | null>`coalesce(${projects.title}, ${goals.title}, ${areas.title})`,
      parentArchived: sql<
        string | null
      >`coalesce(${projects.archivedAt}, ${goals.archivedAt}, ${areas.archivedAt})`,
    })
    .from(tasks)
    .leftJoin(projects, byParent("project", projects.id))
    .leftJoin(goals, byParent("goal", goals.id))
    .leftJoin(areas, byParent("area", areas.id));
}

/** Tasks of an archived parent are hidden. */
const visible = sql`coalesce(${projects.archivedAt}, ${goals.archivedAt}, ${areas.archivedAt}) is null`;

type Row = { task: typeof tasks.$inferSelect; parentTitle: string | null };

function toTask({ task: t, parentTitle }: Row): Task {
  return {
    id: t.id,
    title: t.title,
    doneAt: t.doneAt,
    dueDate: t.dueDate,
    parentType: t.parentType,
    parentId: t.parentId,
    ...(t.parentType && parentTitle !== null ? { parentTitle } : {}),
    sortOrder: t.sortOrder,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

const parentOrder = [asc(tasks.parentType), asc(tasks.parentId), asc(tasks.sortOrder)];
const dueOrder = [asc(tasks.dueDate), ...parentOrder];

async function query(where: (SQL | undefined)[], order: SQL[], includeArchived = false) {
  const rows = await selectWithParent(db())
    .where(and(...where, includeArchived ? undefined : visible))
    .orderBy(...order);
  return rows.map(toTask);
}

/**
 * Tasks filtered by `options`. With `parent`, in the user's order; otherwise by parent,
 * then order. Tasks of archived parents are left out unless `includeArchivedParents`.
 */
export async function list(options: TaskListOptions = {}): Promise<Task[]> {
  const where: (SQL | undefined)[] = [];
  if (options.parent !== undefined) where.push(parentWhere(requireParent(options.parent)));
  if (options.done === true) where.push(isNotNull(tasks.doneAt));
  if (options.done === false) where.push(isNull(tasks.doneAt));
  if (options.dueBefore !== undefined) {
    where.push(lt(tasks.dueDate, optionalDate(options.dueBefore, "마감일") ?? ""));
  }
  if (options.dueFrom !== undefined) {
    where.push(gte(tasks.dueDate, optionalDate(options.dueFrom, "마감일") ?? ""));
  }
  return query(where, parentOrder, options.includeArchivedParents);
}

/** Open tasks due `today` and open tasks due before it (`YYYY-MM-DD`, local calendar). */
export async function listToday(today: string): Promise<{ today: Task[]; overdue: Task[] }> {
  const day = optionalDate(today, "오늘") ?? "";
  const rows = await query([isNull(tasks.doneAt), sql`${tasks.dueDate} <= ${day}`], dueOrder);
  return {
    today: rows.filter((t) => t.dueDate === day),
    overdue: rows.filter((t) => t.dueDate! < day),
  };
}

/** Open tasks due between `from` and `to` (inclusive dates), earliest first. */
export async function listThisWeek(from: string, to: string): Promise<Task[]> {
  const start = optionalDate(from, "시작일") ?? "";
  const end = optionalDate(to, "종료일") ?? "";
  return query(
    [isNull(tasks.doneAt), gte(tasks.dueDate, start), sql`${tasks.dueDate} <= ${end}`],
    dueOrder,
  );
}

function requireInstant(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.includes("T") || Number.isNaN(Date.parse(value))) {
    throw new RepoError("invalid", `${field} 시각 형식이 올바르지 않습니다.`);
  }
  return new Date(value).toISOString();
}

/**
 * Tasks completed in `[from, to)` — ISO instants, e.g. local Monday 00:00 → next Monday
 * 00:00 via `toISOString()` — oldest completion first. Tasks of archived parents count too
 * (the review records what happened).
 */
export async function listCompletedBetween(from: string, to: string): Promise<Task[]> {
  const start = requireInstant(from, "시작");
  const end = requireInstant(to, "끝");
  return query(
    [gte(tasks.doneAt, start), lt(tasks.doneAt, end)],
    [asc(tasks.doneAt), asc(tasks.id)],
    true,
  );
}

/**
 * Done/total per parent, keyed `"type:id"` (`"inbox"` for `null`), in one query. Every
 * asked parent gets an entry (0/0 when it has no tasks).
 */
export async function countFor(
  parents: readonly TaskParent[],
): Promise<Record<string, { done: number; total: number }>> {
  const wanted = parents.map(requireParent);
  const out: Record<string, { done: number; total: number }> = {};
  for (const p of wanted) out[parentKey(p)] = { done: 0, total: 0 };
  if (!wanted.length) return out;
  const conds = [];
  const ids = new Map<TaskParentType, string[]>();
  for (const p of wanted) {
    if (p) ids.set(p.type, [...(ids.get(p.type) ?? []), p.id]);
  }
  for (const [type, list] of ids) {
    conds.push(and(eq(tasks.parentType, type), inArray(tasks.parentId, list)));
  }
  if (wanted.includes(null)) conds.push(isNull(tasks.parentType));
  const rows = await db()
    .select({
      type: tasks.parentType,
      id: tasks.parentId,
      done: sql<number>`sum(case when ${tasks.doneAt} is null then 0 else 1 end)`,
      total: sql<number>`count(*)`,
    })
    .from(tasks)
    .where(or(...conds))
    .groupBy(tasks.parentType, tasks.parentId);
  for (const r of rows) {
    const key = parentKey(r.type && r.id ? { type: r.type, id: r.id } : null);
    if (out[key]) out[key] = { done: Number(r.done), total: Number(r.total) };
  }
  return out;
}

export async function get(id: string, exec: Executor = db()): Promise<Task | null> {
  const [row] = await selectWithParent(exec).where(eq(tasks.id, id));
  return row ? toTask(row) : null;
}

/** The parent must exist and not be archived to get new tasks. */
async function assertAssignableParent(exec: Executor, parent: TaskParent): Promise<void> {
  if (!parent) return;
  const t = { project: projects, goal: goals, area: areas }[parent.type];
  const [row] = await exec
    .select({ archivedAt: t.archivedAt })
    .from(t)
    .where(eq(t.id, parent.id))
    .limit(1);
  if (!row || row.archivedAt) throw new RepoError("not_found", "소속 항목을 찾을 수 없습니다.");
}

/** Adds a task at the end of its parent's list. */
export async function create(input: TaskInput): Promise<Task> {
  const title = requireTaskTitle(input.title);
  const parent = requireParent(input.parent);
  const dueDate = optionalDate(input.dueDate, "마감일");
  // Read back inside the transaction: a read outside the write queue could hit another
  // open transaction on a single-connection database.
  return withTx(async (tx) => {
    await assertAssignableParent(tx, parent);
    const [{ max } = { max: null }] = await tx
      .select({ max: sql<number | null>`max(${tasks.sortOrder})` })
      .from(tasks)
      .where(parentWhere(parent));
    const now = nowIso();
    const id = newId();
    await tx.insert(tasks).values({
      id,
      title,
      dueDate,
      parentType: parent?.type ?? null,
      parentId: parent?.id ?? null,
      sortOrder: (max ?? -1) + 1,
      createdAt: now,
      updatedAt: now,
    });
    return (await get(id, tx))!;
  });
}

/** Patch update; `done` sets or clears the completion time. Null when missing. */
export async function update(id: string, patch: TaskPatch): Promise<Task | null> {
  const set: Partial<typeof tasks.$inferInsert> = {};
  if (patch.title !== undefined) set.title = requireTaskTitle(patch.title);
  if (patch.dueDate !== undefined) set.dueDate = optionalDate(patch.dueDate, "마감일");
  return withTx(async (tx) => {
    const [current] = await tx.select({ doneAt: tasks.doneAt }).from(tasks).where(eq(tasks.id, id));
    if (!current) return null;
    const now = nowIso();
    // Re-checking a done task keeps its original completion time.
    if (patch.done === true && !current.doneAt) set.doneAt = now;
    if (patch.done === false) set.doneAt = null;
    await tx
      .update(tasks)
      .set({ ...set, updatedAt: now })
      .where(eq(tasks.id, id));
    return get(id, tx);
  });
}

/**
 * Moves a task one step up or down among its parent's tasks (swapping order with the
 * neighbour). Returns false when it is missing or already at that end.
 */
export async function move(id: string, direction: "up" | "down"): Promise<boolean> {
  if (direction !== "up" && direction !== "down") {
    throw new RepoError("invalid", "순서가 올바르지 않습니다.");
  }
  return withTx(async (tx) => {
    const [current] = await tx.select().from(tasks).where(eq(tasks.id, id));
    if (!current) return false;
    const siblings = await tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        parentWhere(
          current.parentType && current.parentId
            ? { type: current.parentType, id: current.parentId }
            : null,
        ),
      )
      .orderBy(asc(tasks.sortOrder), asc(tasks.createdAt), asc(tasks.id));
    const i = siblings.findIndex((s) => s.id === id);
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= siblings.length) return false;
    [siblings[i], siblings[j]] = [siblings[j]!, siblings[i]!];
    // Renumber so equal or gapped orders end up distinct.
    for (const [n, s] of siblings.entries()) {
      await tx.update(tasks).set({ sortOrder: n }).where(eq(tasks.id, s.id));
    }
    return true;
  });
}

/**
 * Sets the order of a parent's tasks to `ids` (0, 1, 2, …). Must list every task of that
 * parent exactly once.
 */
export async function reorder(parent: TaskParent, ids: readonly string[]): Promise<void> {
  const p = requireParent(parent);
  if (new Set(ids).size !== ids.length) throw new RepoError("invalid", "순서가 올바르지 않습니다.");
  await withTx(async (tx) => {
    const current = await tx.select({ id: tasks.id }).from(tasks).where(parentWhere(p));
    const known = new Set(current.map((r) => r.id));
    if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
      throw new RepoError("invalid", "할 일 목록이 바뀌었습니다. 새로고침 후 다시 시도하세요.");
    }
    for (const [i, id] of ids.entries()) {
      await tx.update(tasks).set({ sortOrder: i }).where(eq(tasks.id, id));
    }
  });
}

export async function remove(id: string): Promise<boolean> {
  return withTx(async (tx) => {
    const deleted = await tx.delete(tasks).where(eq(tasks.id, id)).returning({ id: tasks.id });
    return deleted.length > 0;
  });
}

/** Deletes every task of `ref` (called from `links.removeLinksFor` when an item is deleted). */
export async function removeTasksOf(exec: Executor, ref: ItemRef): Promise<void> {
  if (!PARENT_TYPES.has(ref.type)) return;
  await exec
    .delete(tasks)
    .where(and(eq(tasks.parentType, ref.type as TaskParentType), eq(tasks.parentId, ref.id)));
}
