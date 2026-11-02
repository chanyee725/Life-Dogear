import { and, asc, desc, eq, type SQL } from "drizzle-orm";
import { seminars } from "@/db/schema";
import { SEMINAR_KIND, type SeminarKind } from "@/lib/enums";
import { SEMINAR_TEMPLATE } from "@/lib/templates";
import { removeLinksFor } from "./links";
import {
  db,
  definedOnly,
  descNullsLast,
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

export type Seminar = typeof seminars.$inferSelect & { tags: string[] };

export type SeminarInput = {
  title: string;
  date?: string | null;
  speaker?: string;
  hostVenue?: string;
  kind?: SeminarKind;
  keyLine?: string;
  materialUrl?: string;
  /** Defaults to the seminar template on create. */
  body?: string;
  tags?: string[];
};
export type SeminarPatch = Partial<SeminarInput>;

export type SeminarSort = "date" | "updated" | "created" | "title";
export type SeminarListOptions = { tag?: string; kind?: SeminarKind; sort?: SeminarSort };

const ORDER: Record<SeminarSort, SQL[]> = {
  date: [descNullsLast(seminars.date), desc(seminars.createdAt)],
  updated: [desc(seminars.updatedAt)],
  created: [desc(seminars.createdAt)],
  title: [asc(seminars.title)],
};

const ref = (id: string) => ({ type: "seminar" as const, id });

async function withTags(rows: (typeof seminars.$inferSelect)[], exec: Executor = db()) {
  const tagMap = await getTagsFor(
    "seminar",
    rows.map((r) => r.id),
    exec,
  );
  return rows.map((r) => ({ ...r, tags: tagMap.get(r.id) ?? [] }));
}

function toColumns(input: SeminarPatch) {
  return definedOnly({
    title: input.title === undefined ? undefined : requireTitle(input.title),
    date: input.date === undefined ? undefined : optionalDate(input.date, "날짜"),
    speaker: input.speaker === undefined ? undefined : trimText(input.speaker),
    hostVenue: input.hostVenue === undefined ? undefined : trimText(input.hostVenue),
    kind: input.kind === undefined ? undefined : requireEnum(SEMINAR_KIND, input.kind, "종류"),
    keyLine: input.keyLine === undefined ? undefined : trimText(input.keyLine),
    materialUrl: input.materialUrl === undefined ? undefined : trimText(input.materialUrl),
    body: input.body,
  });
}

/** Default order: event date, newest first. */
export async function list(options: SeminarListOptions = {}): Promise<Seminar[]> {
  const where: SQL[] = [];
  if (options.kind) where.push(eq(seminars.kind, options.kind));
  if (options.tag) where.push(hasTag(db(), "seminar", seminars.id, options.tag));
  const rows = await db()
    .select()
    .from(seminars)
    .where(where.length ? and(...where) : undefined)
    .orderBy(...orderFor(ORDER, options.sort, "date"));
  return withTags(rows);
}

/** Most recent seminars by date (home dashboard). */
export async function listRecent(limit = 5): Promise<Seminar[]> {
  const rows = await db()
    .select()
    .from(seminars)
    .orderBy(...ORDER.date)
    .limit(limit);
  return withTags(rows);
}

export async function get(id: string): Promise<Seminar | null> {
  const [row] = await db().select().from(seminars).where(eq(seminars.id, id));
  return row ? (await withTags([row]))[0] : null;
}

export async function create(input: SeminarInput): Promise<Seminar> {
  const now = nowIso();
  const id = newId();
  await withTx(async (tx) => {
    await tx.insert(seminars).values({
      id,
      title: requireTitle(input.title),
      body: SEMINAR_TEMPLATE,
      ...toColumns({ ...input, title: undefined, tags: undefined }),
      createdAt: now,
      updatedAt: now,
    });
    if (input.tags) await setTagsWith(tx, ref(id), input.tags);
  });
  return (await get(id))!;
}

export async function update(id: string, patch: SeminarPatch): Promise<Seminar | null> {
  const found = await withTx(async (tx) => {
    const updated = await tx
      .update(seminars)
      .set({ ...toColumns({ ...patch, tags: undefined }), updatedAt: nowIso() })
      .where(eq(seminars.id, id))
      .returning({ id: seminars.id });
    if (!updated.length) return false;
    if (patch.tags) await setTagsWith(tx, ref(id), patch.tags);
    return true;
  });
  return found ? get(id) : null;
}

export async function remove(id: string): Promise<boolean> {
  return withTx(async (tx) => {
    const deleted = await tx
      .delete(seminars)
      .where(eq(seminars.id, id))
      .returning({ id: seminars.id });
    if (!deleted.length) return false;
    await removeLinksFor(tx, ref(id));
    await removeTagsFor(tx, ref(id));
    return true;
  });
}
