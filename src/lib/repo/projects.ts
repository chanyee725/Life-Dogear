import { and, asc, desc, eq, ne, type SQL } from "drizzle-orm";
import { projects } from "@/db/schema";
import {
  PROJECT_KIND,
  PROJECT_STAGE,
  PROJECT_STATUS,
  type ProjectKind,
  type ProjectStage,
  type ProjectStatus,
} from "@/lib/enums";
import { PROJECT_TEMPLATE } from "@/lib/templates";
import { isAssignable } from "./areas";
import { isAssignable as isAssignableGoal } from "./goals";
import { removeLinksFor, syncBodyLinks } from "./links";
import {
  archiveFilter,
  ascNullsLast,
  db,
  definedOnly,
  hasTag,
  newId,
  nowIso,
  optionalDate,
  orderFor,
  RepoError,
  requireEnum,
  requireTitle,
  trimText,
  withTx,
  type ArchiveOptions,
  type Executor,
} from "./shared";
import { getTagsFor, removeTagsFor, setTagsWith } from "./tags";

export type Project = typeof projects.$inferSelect & { tags: string[] };

export type ProjectInput = {
  title: string;
  /** Default "research". */
  kind?: ProjectKind;
  /** Mainly for general projects; research projects keep it in sync with `stage`. */
  status?: ProjectStatus;
  /** Area the project belongs to; `null` clears it. */
  areaId?: string | null;
  /** Goal the project works toward; `null` clears it. */
  goalId?: string | null;
  /** "다음 할 일" — one line. */
  nextAction?: string;
  researchQuestion?: string;
  stage?: ProjectStage;
  startDate?: string | null;
  dueDate?: string | null;
  /** Defaults to the project template on create. */
  body?: string;
  tags?: string[];
};
export type ProjectPatch = Partial<ProjectInput>;

export type ProjectSort = "updated" | "created" | "title" | "due";
export type ProjectListOptions = ArchiveOptions & {
  tag?: string;
  kind?: ProjectKind;
  status?: ProjectStatus;
  stage?: ProjectStage;
  areaId?: string;
  goalId?: string;
  sort?: ProjectSort;
};

const ORDER: Record<ProjectSort, SQL[]> = {
  updated: [desc(projects.updatedAt)],
  created: [desc(projects.createdAt)],
  title: [asc(projects.title)],
  due: [ascNullsLast(projects.dueDate), desc(projects.updatedAt)],
};

const ref = (id: string) => ({ type: "project" as const, id });

async function withTags(rows: (typeof projects.$inferSelect)[], exec: Executor = db()) {
  const tagMap = await getTagsFor(
    "project",
    rows.map((r) => r.id),
    exec,
  );
  return rows.map((r) => ({ ...r, tags: tagMap.get(r.id) ?? [] }));
}

type Lifecycle = Pick<typeof projects.$inferSelect, "kind" | "stage" | "status" | "completedAt">;

/**
 * Keeps stage, status and completion time consistent (pure; exported for tests).
 * Research: stage `submitted` ⇔ status `done`. Setting the stage wins over a status in
 * the same patch; reopening a submitted project via status moves it back to `revising`.
 * Without stage or status in the patch (e.g. a kind change), status decides.
 * Any kind: `completedAt` is stamped when the project becomes done and cleared otherwise.
 */
export function deriveLifecycle(
  current: Lifecycle,
  patch: Partial<Pick<Lifecycle, "kind" | "stage" | "status">>,
  now: string,
): Lifecycle {
  const kind = patch.kind ?? current.kind;
  let stage = patch.stage ?? current.stage;
  let status = patch.status ?? current.status;

  if (kind === "research") {
    if (patch.stage !== undefined) {
      if (stage === "submitted") status = "done";
      else if (status === "done") status = "active";
    } else if (patch.status !== undefined) {
      if (status === "done") stage = "submitted";
      else if (stage === "submitted") stage = "revising";
    } else if (status === "done") {
      // Kind-only change (e.g. general → research): status is the source of truth.
      stage = "submitted";
    } else if (stage === "submitted") {
      stage = "revising";
    }
  }

  const completedAt =
    status === "done" ? ((current.status === "done" ? current.completedAt : null) ?? now) : null;
  return { kind, stage, status, completedAt };
}

async function validAreaId(exec: Executor, areaId: string | null | undefined) {
  if (areaId === undefined || areaId === null || areaId === "")
    return areaId === "" ? null : areaId;
  if (!(await isAssignable(areaId, exec))) {
    throw new RepoError("not_found", "영역을 찾을 수 없습니다.");
  }
  return areaId;
}

/** New goal id must be assignable; keeping the current (maybe archived) goal is fine. */
async function validGoalId(
  exec: Executor,
  goalId: string | null | undefined,
  current: string | null = null,
) {
  if (goalId === undefined) return undefined;
  if (goalId === null || goalId === "") return null;
  if (goalId !== current && !(await isAssignableGoal(goalId, exec))) {
    throw new RepoError("not_found", "목표를 찾을 수 없습니다.");
  }
  return goalId;
}

function toColumns(input: ProjectPatch) {
  return definedOnly({
    title: input.title === undefined ? undefined : requireTitle(input.title),
    nextAction: input.nextAction === undefined ? undefined : trimText(input.nextAction),
    researchQuestion:
      input.researchQuestion === undefined ? undefined : trimText(input.researchQuestion),
    startDate: input.startDate === undefined ? undefined : optionalDate(input.startDate, "시작일"),
    dueDate: input.dueDate === undefined ? undefined : optionalDate(input.dueDate, "마감일"),
    body: input.body,
  });
}

function lifecyclePatch(input: ProjectPatch) {
  return definedOnly({
    kind: input.kind === undefined ? undefined : requireEnum(PROJECT_KIND, input.kind, "종류"),
    stage: input.stage === undefined ? undefined : requireEnum(PROJECT_STAGE, input.stage, "단계"),
    status:
      input.status === undefined ? undefined : requireEnum(PROJECT_STATUS, input.status, "상태"),
  });
}

/** Non-archived projects by default; see {@link ArchiveOptions}. */
export async function list(options: ProjectListOptions = {}): Promise<Project[]> {
  const where: (SQL | undefined)[] = [archiveFilter(projects.archivedAt, options)];
  if (options.kind) where.push(eq(projects.kind, options.kind));
  if (options.status) where.push(eq(projects.status, options.status));
  if (options.stage) where.push(eq(projects.stage, options.stage));
  if (options.areaId) where.push(eq(projects.areaId, options.areaId));
  if (options.goalId) where.push(eq(projects.goalId, options.goalId));
  if (options.tag) where.push(hasTag(db(), "project", projects.id, options.tag));
  const rows = await db()
    .select()
    .from(projects)
    .where(and(...where))
    .orderBy(...orderFor(ORDER, options.sort, "updated"));
  return withTags(rows);
}

export async function get(id: string): Promise<Project | null> {
  const [row] = await db().select().from(projects).where(eq(projects.id, id));
  return row ? (await withTags([row]))[0] : null;
}

export async function create(input: ProjectInput): Promise<Project> {
  const now = nowIso();
  const id = newId();
  const columns = toColumns({ ...input, title: undefined, tags: undefined });
  const lifecycle = deriveLifecycle(
    { kind: "research", stage: "exploring", status: "active", completedAt: null },
    lifecyclePatch(input),
    now,
  );
  await withTx(async (tx) => {
    const areaId = await validAreaId(tx, input.areaId);
    const goalId = await validGoalId(tx, input.goalId);
    await tx.insert(projects).values({
      id,
      title: requireTitle(input.title),
      body: PROJECT_TEMPLATE,
      ...columns,
      ...lifecycle,
      areaId: areaId ?? null,
      goalId: goalId ?? null,
      createdAt: now,
      updatedAt: now,
    });
    if (input.tags) await setTagsWith(tx, ref(id), input.tags);
    if (input.body) await syncBodyLinks(tx, ref(id), input.body);
  });
  return (await get(id))!;
}

export async function update(id: string, patch: ProjectPatch): Promise<Project | null> {
  const columns = toColumns({ ...patch, tags: undefined });
  const lifecycleInput = lifecyclePatch(patch);
  const found = await withTx(async (tx) => {
    const [current] = await tx
      .select({
        kind: projects.kind,
        stage: projects.stage,
        status: projects.status,
        completedAt: projects.completedAt,
        goalId: projects.goalId,
      })
      .from(projects)
      .where(eq(projects.id, id));
    if (!current) return false;
    const now = nowIso();
    const areaId = await validAreaId(tx, patch.areaId);
    const goalId = await validGoalId(tx, patch.goalId, current.goalId);
    await tx
      .update(projects)
      .set({
        ...columns,
        ...deriveLifecycle(current, lifecycleInput, now),
        ...(areaId !== undefined ? { areaId } : {}),
        ...(goalId !== undefined ? { goalId } : {}),
        updatedAt: now,
      })
      .where(eq(projects.id, id));
    if (patch.tags) await setTagsWith(tx, ref(id), patch.tags);
    if (patch.body !== undefined) await syncBodyLinks(tx, ref(id), patch.body);
    return true;
  });
  return found ? get(id) : null;
}

export async function remove(id: string): Promise<boolean> {
  return withTx(async (tx) => {
    const deleted = await tx
      .delete(projects)
      .where(eq(projects.id, id))
      .returning({ id: projects.id });
    if (!deleted.length) return false;
    await removeLinksFor(tx, ref(id));
    await removeTagsFor(tx, ref(id));
    return true;
  });
}

export type StageColumn = { stage: ProjectStage; items: Project[] };

/**
 * Kanban columns for research projects in stage order; items sorted by due date
 * (soonest first). Archived projects are left out; `submitted` only on request.
 */
export async function listByStage(
  options: { includeSubmitted?: boolean } = {},
): Promise<StageColumn[]> {
  const rows = await db()
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.kind, "research"),
        archiveFilter(projects.archivedAt),
        options.includeSubmitted ? undefined : ne(projects.stage, "submitted"),
      ),
    )
    .orderBy(...ORDER.due);
  const items = await withTags(rows);
  return PROJECT_STAGE.values
    .filter((stage) => options.includeSubmitted || stage !== "submitted")
    .map((stage) => ({ stage, items: items.filter((p) => p.stage === stage) }));
}

/**
 * General (non-research) projects for the home "그 외" tab: not archived, not done,
 * soonest due first.
 */
export async function listActiveGeneral(): Promise<Project[]> {
  const rows = await db()
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.kind, "general"),
        archiveFilter(projects.archivedAt),
        ne(projects.status, "done"),
      ),
    )
    .orderBy(...ORDER.due);
  return withTags(rows);
}
