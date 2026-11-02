import { desc, eq, inArray, sql } from "drizzle-orm";
import { papers, projects, seminars, thoughts } from "@/db/schema";
import { ITEM_TYPE } from "@/lib/enums";
import { assertItemRef, db, type Executor, type ItemRef, type ItemType } from "./shared";

export type ItemSummary = { ref: ItemRef; type: ItemType; title: string };

const TABLES = { project: projects, paper: papers, seminar: seminars, thought: thoughts } as const;

export const tableFor = (type: ItemType) => TABLES[type];

export async function exists(ref: ItemRef, exec: Executor = db()): Promise<boolean> {
  assertItemRef(ref);
  const t = tableFor(ref.type);
  const rows = await exec.select({ id: t.id }).from(t).where(eq(t.id, ref.id)).limit(1);
  return rows.length > 0;
}

/** Titles for a mixed list of refs, keyed `type:id`. Missing items are absent. */
export async function getTitles(
  refs: readonly ItemRef[],
  exec: Executor = db(),
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const type of ITEM_TYPE.values) {
    const ids = refs.filter((r) => r.type === type).map((r) => r.id);
    if (!ids.length) continue;
    const t = tableFor(type);
    const rows = await exec.select({ id: t.id, title: t.title }).from(t).where(inArray(t.id, ids));
    for (const r of rows) out.set(refKey({ type, id: r.id }), r.title);
  }
  return out;
}

export const refKey = (ref: ItemRef): string => `${ref.type}:${ref.id}`;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Title search across all four types for the link picker (not body search).
 * Prefix matches rank first, then most recently updated. Empty query returns recent items.
 */
export async function searchTitles(
  query: string,
  excludeRef?: ItemRef,
  limit = 20,
): Promise<ItemSummary[]> {
  const q = query.trim().toLowerCase();
  const pattern = `%${escapeLike(q)}%`;
  const rows: (ItemSummary & { updatedAt: string; prefix: boolean })[] = [];

  for (const type of ITEM_TYPE.values) {
    const t = tableFor(type);
    const found = await db()
      .select({ id: t.id, title: t.title, updatedAt: t.updatedAt })
      .from(t)
      .where(q ? sql`lower(${t.title}) like ${pattern} escape '\\'` : undefined)
      .orderBy(desc(t.updatedAt))
      .limit(limit + 1);
    for (const r of found) {
      if (excludeRef && excludeRef.type === type && excludeRef.id === r.id) continue;
      rows.push({
        ref: { type, id: r.id },
        type,
        title: r.title,
        updatedAt: r.updatedAt,
        prefix: q !== "" && r.title.toLowerCase().startsWith(q),
      });
    }
  }

  rows.sort(
    (a, b) => Number(b.prefix) - Number(a.prefix) || b.updatedAt.localeCompare(a.updatedAt),
  );
  return rows.slice(0, limit).map(({ ref, type, title }) => ({ ref, type, title }));
}
