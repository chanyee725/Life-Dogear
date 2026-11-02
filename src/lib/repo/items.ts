import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { areas, goals, papers, projects, reviews, seminars, thoughts } from "@/db/schema";
import { ITEM_TYPE } from "@/lib/enums";
import { titleKey } from "@/lib/wikilinks";
import { assertItemRef, db, type Executor, type ItemRef, type ItemType } from "./shared";

/** `archived` is set only where it matters (connected items); pickers never return archived items. */
export type ItemSummary = { ref: ItemRef; type: ItemType; title: string; archived?: boolean };

const TABLES = {
  project: projects,
  paper: papers,
  seminar: seminars,
  thought: thoughts,
  area: areas,
  goal: goals,
  review: reviews,
} as const;

export const tableFor = (type: ItemType) => TABLES[type];

export async function exists(ref: ItemRef, exec: Executor = db()): Promise<boolean> {
  assertItemRef(ref);
  const t = tableFor(ref.type);
  const rows = await exec.select({ id: t.id }).from(t).where(eq(t.id, ref.id)).limit(1);
  return rows.length > 0;
}

export type ItemHead = { title: string; archived: boolean };

/** Title and archived flag for a mixed list of refs, keyed `type:id`. Missing items are absent. */
export async function getHeads(
  refs: readonly ItemRef[],
  exec: Executor = db(),
): Promise<Map<string, ItemHead>> {
  const out = new Map<string, ItemHead>();
  for (const type of ITEM_TYPE.values) {
    const ids = refs.filter((r) => r.type === type).map((r) => r.id);
    if (!ids.length) continue;
    const t = tableFor(type);
    const rows = await exec
      .select({ id: t.id, title: t.title, archivedAt: t.archivedAt })
      .from(t)
      .where(inArray(t.id, ids));
    for (const r of rows) {
      out.set(refKey({ type, id: r.id }), { title: r.title, archived: r.archivedAt !== null });
    }
  }
  return out;
}

/** Titles for a mixed list of refs, keyed `type:id`. Missing items are absent. */
export async function getTitles(
  refs: readonly ItemRef[],
  exec: Executor = db(),
): Promise<Map<string, string>> {
  const heads = await getHeads(refs, exec);
  return new Map([...heads].map(([k, h]) => [k, h.title]));
}

export const refKey = (ref: ItemRef): string => `${ref.type}:${ref.id}`;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Title search across all item types (areas included) for the link picker — not body
 * search. Archived items are left out. Prefix matches rank first, then most recently
 * updated. Empty query returns recent items.
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
      .where(
        and(
          isNull(t.archivedAt),
          q ? sql`lower(${t.title}) like ${pattern} escape '\\'` : undefined,
        ),
      )
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

/**
 * Items for `[[title]]` links, keyed by `titleKey` (case-insensitive, trimmed). When
 * several items share a title, a non-archived one wins, then the most recently updated.
 * Titles nothing matches are absent.
 */
export async function resolveTitles(
  titles: readonly string[],
  exec: Executor = db(),
): Promise<Map<string, ItemSummary>> {
  const keys = [...new Set(titles.map(titleKey).filter(Boolean))];
  const best = new Map<string, ItemSummary & { updatedAt: string }>();
  if (!keys.length) return new Map();
  for (const type of ITEM_TYPE.values) {
    const t = tableFor(type);
    const rows = await exec
      .select({ id: t.id, title: t.title, archivedAt: t.archivedAt, updatedAt: t.updatedAt })
      .from(t)
      .where(inArray(sql`lower(trim(${t.title}))`, keys));
    for (const r of rows) {
      const key = titleKey(r.title);
      const archived = r.archivedAt !== null;
      const current = best.get(key);
      const better =
        !current ||
        (current.archived && !archived) ||
        (current.archived === archived && r.updatedAt > current.updatedAt);
      if (better) {
        best.set(key, {
          ref: { type, id: r.id },
          type,
          title: r.title,
          archived,
          updatedAt: r.updatedAt,
        });
      }
    }
  }
  return new Map(
    [...best].map(([k, s]) => [
      k,
      { ref: s.ref, type: s.type, title: s.title, archived: s.archived },
    ]),
  );
}

/** Markdown body of an item, or null if it does not exist. */
export async function getBody(ref: ItemRef, exec: Executor = db()): Promise<string | null> {
  const t = tableFor(ref.type);
  const [row] = await exec.select({ body: t.body }).from(t).where(eq(t.id, ref.id)).limit(1);
  return row ? row.body : null;
}
