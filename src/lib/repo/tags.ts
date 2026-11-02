import { and, asc, eq, inArray, notExists, sql } from "drizzle-orm";
import { itemTags, tags } from "@/db/schema";
import { assertItemRef, db, newId, type Executor, type ItemRef, type ItemType } from "./shared";

export type TagCount = { name: string; count: number };

/** Trims, drops a leading `#`, collapses spaces and de-duplicates case-insensitively. */
export function normalizeTagNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.trim().replace(/^#+/, "").replace(/\s+/g, " ").trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/** Replaces the tags of an item. Existing tags keep their original spelling. */
export async function setTags(ref: ItemRef, names: readonly string[]): Promise<string[]> {
  assertItemRef(ref);
  return db().transaction((tx) => setTagsWith(tx, ref, names));
}

export async function setTagsWith(
  exec: Executor,
  ref: ItemRef,
  names: readonly string[],
): Promise<string[]> {
  const wanted = normalizeTagNames(names);
  const lowered = wanted.map((n) => n.toLowerCase());
  const existing = lowered.length
    ? await exec
        .select()
        .from(tags)
        .where(inArray(sql`lower(${tags.name})`, lowered))
    : [];
  const byKey = new Map(existing.map((t) => [t.name.toLowerCase(), t]));

  const resolved: { id: string; name: string }[] = [];
  for (const name of wanted) {
    let tag = byKey.get(name.toLowerCase());
    if (!tag) {
      tag = { id: newId(), name };
      await exec.insert(tags).values(tag);
      byKey.set(name.toLowerCase(), tag);
    }
    resolved.push(tag);
  }

  await exec
    .delete(itemTags)
    .where(and(eq(itemTags.itemType, ref.type), eq(itemTags.itemId, ref.id)));
  if (resolved.length) {
    await exec
      .insert(itemTags)
      .values(resolved.map((t) => ({ itemType: ref.type, itemId: ref.id, tagId: t.id })));
  }
  await pruneOrphanTags(exec);
  return resolved.map((t) => t.name);
}

export async function getTags(ref: ItemRef): Promise<string[]> {
  assertItemRef(ref);
  const rows = await db()
    .select({ name: tags.name })
    .from(itemTags)
    .innerJoin(tags, eq(tags.id, itemTags.tagId))
    .where(and(eq(itemTags.itemType, ref.type), eq(itemTags.itemId, ref.id)))
    .orderBy(asc(tags.name));
  return rows.map((r) => r.name);
}

/** Tags for many items of one type at once (for list views). */
export async function getTagsFor(
  type: ItemType,
  ids: readonly string[],
  exec: Executor = db(),
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>(ids.map((id) => [id, []]));
  if (!ids.length) return result;
  const rows = await exec
    .select({ itemId: itemTags.itemId, name: tags.name })
    .from(itemTags)
    .innerJoin(tags, eq(tags.id, itemTags.tagId))
    .where(and(eq(itemTags.itemType, type), inArray(itemTags.itemId, [...ids])))
    .orderBy(asc(tags.name));
  for (const r of rows) result.get(r.itemId)?.push(r.name);
  return result;
}

/** All tags in use, with how many items carry each. */
export async function listAll(): Promise<TagCount[]> {
  const rows = await db()
    .select({ name: tags.name, count: sql<number>`count(*)`.mapWith(Number) })
    .from(tags)
    .innerJoin(itemTags, eq(itemTags.tagId, tags.id))
    .groupBy(tags.id)
    .orderBy(asc(tags.name));
  return rows;
}

export async function removeTagsFor(exec: Executor, ref: ItemRef): Promise<void> {
  await exec
    .delete(itemTags)
    .where(and(eq(itemTags.itemType, ref.type), eq(itemTags.itemId, ref.id)));
  await pruneOrphanTags(exec);
}

export async function pruneOrphanTags(exec: Executor): Promise<void> {
  await exec
    .delete(tags)
    .where(notExists(exec.select().from(itemTags).where(eq(itemTags.tagId, tags.id))));
}
