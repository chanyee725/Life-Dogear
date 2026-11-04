import { and, asc, desc, eq, inArray, isNull, or, type SQL } from "drizzle-orm";
import { links, notes } from "@/db/schema";
import { NOTE_SOURCE_KIND, type NoteSourceKind } from "@/lib/enums";
import { isAssignable } from "./areas";
import { linkWith, removeLinksFor, syncBodyLinks } from "./links";
import {
  archiveFilter,
  type ArchiveOptions,
  assertItemRef,
  db,
  definedOnly,
  type Executor,
  hasTag,
  newId,
  nowIso,
  orderFor,
  RepoError,
  requireEnum,
  requireTitle,
  trimText,
  type ItemRef,
  withTx,
} from "./shared";
import { getTagsFor, removeTagsFor, setTagsWith } from "./tags";

export type Note = typeof notes.$inferSelect & { tags: string[] };

export type NoteInput = {
  title: string;
  body?: string;
  /** null or "" clears it. */
  sourceKind?: NoteSourceKind | "" | null;
  sourceTitle?: string | null;
  /** http(s) only; null or "" clears it. */
  sourceUrl?: string | null;
  /** Must be a live area; null or "" clears it. */
  areaId?: string | null;
  tags?: string[];
};
export type NotePatch = Partial<NoteInput>;
/** Create-only: an item the new note is linked to by hand, in the same transaction. */
export type NoteCreateInput = NoteInput & { linkTo?: ItemRef };

export type NoteSort = "updated" | "created" | "title";
export type NoteListOptions = ArchiveOptions & {
  tag?: string;
  sourceKind?: NoteSourceKind;
  areaId?: string;
  sort?: NoteSort;
};

const ORDER: Record<NoteSort, SQL[]> = {
  updated: [desc(notes.updatedAt)],
  created: [desc(notes.createdAt)],
  title: [asc(notes.title)],
};

const ref = (id: string) => ({ type: "note" as const, id });

/** Trimmed `http:`/`https:` URL, null for empty input; anything else is rejected. */
export function optionalHttpUrl(value: unknown): string | null {
  const text = trimText(value);
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new RepoError("invalid", "출처 링크는 http(s) 주소여야 합니다.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new RepoError("invalid", "출처 링크는 http(s) 주소여야 합니다.");
  }
  return text;
}

const nullIfEmpty = (value: unknown): string | null => trimText(value) || null;

async function validAreaId(exec: Executor, areaId: string | null | undefined) {
  if (areaId === undefined) return undefined;
  if (areaId === null || areaId === "") return null;
  if (!(await isAssignable(areaId, exec))) {
    throw new RepoError("not_found", "영역을 찾을 수 없습니다.");
  }
  return areaId;
}

function toColumns(input: NotePatch) {
  return definedOnly({
    title: input.title === undefined ? undefined : requireTitle(input.title),
    body: input.body,
    sourceKind:
      input.sourceKind === undefined
        ? undefined
        : input.sourceKind === null || input.sourceKind === ""
          ? null
          : requireEnum(NOTE_SOURCE_KIND, input.sourceKind, "출처 종류"),
    sourceTitle: input.sourceTitle === undefined ? undefined : nullIfEmpty(input.sourceTitle),
    sourceUrl: input.sourceUrl === undefined ? undefined : optionalHttpUrl(input.sourceUrl),
  });
}

async function withTags(rows: (typeof notes.$inferSelect)[], exec: Executor = db()) {
  const tagMap = await getTagsFor(
    "note",
    rows.map((r) => r.id),
    exec,
  );
  return rows.map((r) => ({ ...r, tags: tagMap.get(r.id) ?? [] }));
}

/** Non-archived by default; see {@link ArchiveOptions}. */
export async function list(options: NoteListOptions = {}): Promise<Note[]> {
  const where: (SQL | undefined)[] = [archiveFilter(notes.archivedAt, options)];
  if (options.sourceKind) where.push(eq(notes.sourceKind, options.sourceKind));
  if (options.areaId) where.push(eq(notes.areaId, options.areaId));
  if (options.tag) where.push(hasTag(db(), "note", notes.id, options.tag));
  const rows = await db()
    .select()
    .from(notes)
    .where(and(...where))
    .orderBy(...orderFor(ORDER, options.sort, "updated"));
  return withTags(rows);
}

/**
 * Non-archived notes of a project, goal, area or note: those linked to it (either
 * direction) and, for an area, those whose `areaId` is it. Newest edit first, no repeats.
 */
export async function listForItem(item: ItemRef): Promise<Note[]> {
  assertItemRef(item);
  const rows = await db()
    .select()
    .from(links)
    .where(
      or(
        and(
          eq(links.sourceType, item.type),
          eq(links.sourceId, item.id),
          eq(links.targetType, "note"),
        ),
        and(
          eq(links.targetType, item.type),
          eq(links.targetId, item.id),
          eq(links.sourceType, "note"),
        ),
      ),
    );
  const ids = rows.map((l) => (l.sourceType === "note" ? l.sourceId : l.targetId));
  const match: (SQL | undefined)[] = [];
  if (ids.length) match.push(inArray(notes.id, ids));
  if (item.type === "area") match.push(eq(notes.areaId, item.id));
  if (!match.length) return [];
  const found = await db()
    .select()
    .from(notes)
    .where(and(isNull(notes.archivedAt), or(...match)))
    .orderBy(desc(notes.updatedAt));
  return withTags(found.filter((n) => !(item.type === "note" && n.id === item.id)));
}

export async function get(id: string): Promise<Note | null> {
  const [row] = await db().select().from(notes).where(eq(notes.id, id));
  return row ? (await withTags([row]))[0] : null;
}

export async function create(input: NoteCreateInput): Promise<Note> {
  const now = nowIso();
  const id = newId();
  await withTx(async (tx) => {
    const areaId = await validAreaId(tx, input.areaId);
    await tx.insert(notes).values({
      id,
      title: requireTitle(input.title),
      ...toColumns({ ...input, title: undefined, tags: undefined, areaId: undefined }),
      areaId: areaId ?? null,
      createdAt: now,
      updatedAt: now,
    });
    if (input.tags) await setTagsWith(tx, ref(id), input.tags);
    if (input.body) await syncBodyLinks(tx, ref(id), input.body);
    if (input.linkTo) await linkWith(tx, input.linkTo, ref(id));
  });
  return (await get(id))!;
}

export async function update(id: string, patch: NotePatch): Promise<Note | null> {
  const found = await withTx(async (tx) => {
    const columns = toColumns({ ...patch, tags: undefined, areaId: undefined });
    const areaId = await validAreaId(tx, patch.areaId);
    const updated = await tx
      .update(notes)
      .set({
        ...columns,
        ...(areaId !== undefined ? { areaId } : {}),
        updatedAt: nowIso(),
      })
      .where(eq(notes.id, id))
      .returning({ id: notes.id });
    if (!updated.length) return false;
    if (patch.tags) await setTagsWith(tx, ref(id), patch.tags);
    if (patch.body !== undefined) await syncBodyLinks(tx, ref(id), patch.body);
    return true;
  });
  return found ? get(id) : null;
}

export async function remove(id: string): Promise<boolean> {
  return withTx(async (tx) => {
    const deleted = await tx.delete(notes).where(eq(notes.id, id)).returning({ id: notes.id });
    if (!deleted.length) return false;
    await removeLinksFor(tx, ref(id));
    await removeTagsFor(tx, ref(id));
    return true;
  });
}
