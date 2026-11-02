import { desc, eq, isNotNull } from "drizzle-orm";
import { ITEM_TYPE } from "@/lib/enums";
import { tableFor } from "./items";
import { assertItemRef, db, nowIso, serializeWrite, type ItemRef, type ItemType } from "./shared";

export type ArchivedItem = { ref: ItemRef; type: ItemType; title: string; archivedAt: string };

async function setArchivedAt(ref: ItemRef, value: string | null): Promise<boolean> {
  assertItemRef(ref);
  const t = tableFor(ref.type);
  // Archiving is not an edit: `updatedAt` stays as it was.
  const rows = await serializeWrite(() =>
    db().update(t).set({ archivedAt: value }).where(eq(t.id, ref.id)).returning({ id: t.id }),
  );
  return rows.length > 0;
}

/** Hides the item from lists, home and the link picker. Returns false if not found. */
export const archive = (ref: ItemRef): Promise<boolean> => setArchivedAt(ref, nowIso());

export const unarchive = (ref: ItemRef): Promise<boolean> => setArchivedAt(ref, null);

/** Everything archived, newest archive first (the `/archive` page). */
export async function listArchived(): Promise<ArchivedItem[]> {
  const out: ArchivedItem[] = [];
  for (const type of ITEM_TYPE.values) {
    const t = tableFor(type);
    const rows = await db()
      .select({ id: t.id, title: t.title, archivedAt: t.archivedAt })
      .from(t)
      .where(isNotNull(t.archivedAt))
      .orderBy(desc(t.archivedAt));
    for (const r of rows) {
      out.push({ ref: { type, id: r.id }, type, title: r.title, archivedAt: r.archivedAt! });
    }
  }
  return out.sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
}
