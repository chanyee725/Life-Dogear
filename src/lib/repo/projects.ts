import { and, asc, desc, eq, ne, type SQL } from "drizzle-orm";
import { projects } from "@/db/schema";
import { PROJECT_STAGE, type ProjectStage } from "@/lib/enums";
import { PROJECT_TEMPLATE } from "@/lib/templates";
import { removeLinksFor } from "./links";
import {
  ascNullsLast,
  db,
  definedOnly,
  hasTag,
  newId,
  nowIso,
  optionalDate,
  requireEnum,
  requireTitle,
  trimText,
  type Executor,
  orderFor,
  withTx,
} from "./shared";
import { getTagsFor, removeTagsFor, setTagsWith } from "./tags";

export type Project = typeof projects.$inferSelect & { tags: string[] };

export type ProjectInput = {
  title: string;
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
export type ProjectListOptions = { tag?: string; stage?: ProjectStage; sort?: ProjectSort };

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

function toColumns(input: ProjectPatch) {
  return definedOnly({
    title: input.title === undefined ? undefined : requireTitle(input.title),
    researchQuestion:
      input.researchQuestion === undefined ? undefined : trimText(input.researchQuestion),
    stage: input.stage === undefined ? undefined : requireEnum(PROJECT_STAGE, input.stage, "단계"),
    startDate: input.startDate === undefined ? undefined : optionalDate(input.startDate, "시작일"),
    dueDate: input.dueDate === undefined ? undefined : optionalDate(input.dueDate, "마감일"),
    body: input.body,
  });
}

export async function list(options: ProjectListOptions = {}): Promise<Project[]> {
  const where: SQL[] = [];
  if (options.stage) where.push(eq(projects.stage, options.stage));
  if (options.tag) where.push(hasTag(db(), "project", projects.id, options.tag));
  const rows = await db()
    .select()
    .from(projects)
    .where(where.length ? and(...where) : undefined)
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
  await withTx(async (tx) => {
    await tx.insert(projects).values({
      id,
      title: requireTitle(input.title),
      body: PROJECT_TEMPLATE,
      ...toColumns({ ...input, title: undefined, tags: undefined }),
      createdAt: now,
      updatedAt: now,
    });
    if (input.tags) await setTagsWith(tx, ref(id), input.tags);
  });
  return (await get(id))!;
}

export async function update(id: string, patch: ProjectPatch): Promise<Project | null> {
  const found = await withTx(async (tx) => {
    const updated = await tx
      .update(projects)
      .set({ ...toColumns({ ...patch, tags: undefined }), updatedAt: nowIso() })
      .where(eq(projects.id, id))
      .returning({ id: projects.id });
    if (!updated.length) return false;
    if (patch.tags) await setTagsWith(tx, ref(id), patch.tags);
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

/** Kanban columns in stage order; items sorted by due date (soonest first). */
export async function listByStage(
  options: { includeSubmitted?: boolean } = {},
): Promise<StageColumn[]> {
  const rows = await db()
    .select()
    .from(projects)
    .where(options.includeSubmitted ? undefined : ne(projects.stage, "submitted"))
    .orderBy(...ORDER.due);
  const items = await withTags(rows);
  return PROJECT_STAGE.values
    .filter((stage) => options.includeSubmitted || stage !== "submitted")
    .map((stage) => ({ stage, items: items.filter((p) => p.stage === stage) }));
}
