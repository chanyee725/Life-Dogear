import { and, asc, eq, sql } from "drizzle-orm";
import { areas, projects } from "@/db/schema";
import { removeLinksFor } from "./links";
import {
  archiveFilter,
  db,
  definedOnly,
  newId,
  nowIso,
  RepoError,
  requireTitle,
  trimText,
  withTx,
  type ArchiveOptions,
  type Executor,
} from "./shared";
import { getTagsFor, removeTagsFor, setTagsWith } from "./tags";

export type Area = typeof areas.$inferSelect & { tags: string[] };

export type AreaInput = {
  title: string;
  /** "유지 기준" — what keeping this area healthy means. */
  standard?: string;
  body?: string;
  tags?: string[];
};
export type AreaPatch = Partial<AreaInput>;
export type AreaListOptions = ArchiveOptions;

const ref = (id: string) => ({ type: "area" as const, id });

async function withTags(rows: (typeof areas.$inferSelect)[], exec: Executor = db()) {
  const tagMap = await getTagsFor(
    "area",
    rows.map((r) => r.id),
    exec,
  );
  return rows.map((r) => ({ ...r, tags: tagMap.get(r.id) ?? [] }));
}

function toColumns(input: AreaPatch) {
  return definedOnly({
    title: input.title === undefined ? undefined : requireTitle(input.title),
    standard: input.standard === undefined ? undefined : trimText(input.standard),
    body: input.body,
  });
}

/** Areas in the user's order (`sortOrder`, then title). */
export async function list(options: AreaListOptions = {}): Promise<Area[]> {
  const rows = await db()
    .select()
    .from(areas)
    .where(archiveFilter(areas.archivedAt, options))
    .orderBy(asc(areas.sortOrder), asc(areas.title));
  return withTags(rows);
}

export async function get(id: string): Promise<Area | null> {
  const [row] = await db().select().from(areas).where(eq(areas.id, id));
  return row ? (await withTags([row]))[0] : null;
}

/** Creates an area at the end of the order. */
export async function create(input: AreaInput): Promise<Area> {
  const id = await withTx((tx) => createWith(tx, input));
  return (await get(id))!;
}

/** Creates several areas in one transaction, appended in the given order. */
export async function createMany(inputs: readonly AreaInput[]): Promise<Area[]> {
  const ids = await withTx(async (tx) => {
    const out: string[] = [];
    for (const input of inputs) out.push(await createWith(tx, input));
    return out;
  });
  const all = await list({ includeArchived: true });
  return ids.map((id) => all.find((a) => a.id === id)!);
}

async function createWith(exec: Executor, input: AreaInput): Promise<string> {
  const now = nowIso();
  const id = newId();
  const [{ max }] = await exec
    .select({ max: sql<number | null>`max(${areas.sortOrder})` })
    .from(areas);
  await exec.insert(areas).values({
    id,
    title: requireTitle(input.title),
    ...toColumns({ ...input, title: undefined, tags: undefined }),
    sortOrder: (max ?? -1) + 1,
    createdAt: now,
    updatedAt: now,
  });
  if (input.tags) await setTagsWith(exec, ref(id), input.tags);
  return id;
}

export async function update(id: string, patch: AreaPatch): Promise<Area | null> {
  const found = await withTx(async (tx) => {
    const updated = await tx
      .update(areas)
      .set({ ...toColumns({ ...patch, tags: undefined }), updatedAt: nowIso() })
      .where(eq(areas.id, id))
      .returning({ id: areas.id });
    if (!updated.length) return false;
    if (patch.tags) await setTagsWith(tx, ref(id), patch.tags);
    return true;
  });
  return found ? get(id) : null;
}

/**
 * Sets the order to `ids` (0, 1, 2, …). Must list every non-archived area exactly once;
 * archived areas keep their position after them.
 */
export async function reorder(ids: readonly string[]): Promise<void> {
  if (new Set(ids).size !== ids.length) throw new RepoError("invalid", "순서가 올바르지 않습니다.");
  await withTx(async (tx) => {
    const current = await tx
      .select({ id: areas.id })
      .from(areas)
      .where(archiveFilter(areas.archivedAt));
    const known = new Set(current.map((r) => r.id));
    if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
      throw new RepoError("invalid", "영역 목록이 바뀌었습니다. 새로고침 후 다시 시도하세요.");
    }
    for (const [i, id] of ids.entries()) {
      await tx.update(areas).set({ sortOrder: i }).where(eq(areas.id, id));
    }
  });
}

/** Deletes the area; its projects stay but lose the area, links and tags are removed. */
export async function remove(id: string): Promise<boolean> {
  return withTx(async (tx) => {
    const deleted = await tx.delete(areas).where(eq(areas.id, id)).returning({ id: areas.id });
    if (!deleted.length) return false;
    await tx.update(projects).set({ areaId: null }).where(eq(projects.areaId, id));
    await removeLinksFor(tx, ref(id));
    await removeTagsFor(tx, ref(id));
    return true;
  });
}

/** True when the area exists and is not archived (for assigning projects). */
export async function isAssignable(id: string, exec: Executor = db()): Promise<boolean> {
  const rows = await exec
    .select({ id: areas.id })
    .from(areas)
    .where(and(eq(areas.id, id), archiveFilter(areas.archivedAt)))
    .limit(1);
  return rows.length > 0;
}
