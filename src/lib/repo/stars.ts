/**
 * "중요" stars (`item_stars`) for the cosmos view. A star is a manual weight in the
 * importance score; rows are removed with their item (`links.removeLinksFor`).
 */
import { and, eq } from "drizzle-orm";
import { itemStars } from "@/db/schema";
import { exists, refKey } from "./items";
import { assertItemRef, db, nowIso, RepoError, withTx, type ItemRef } from "./shared";

/** Keys (`"<type>:<id>"`) of every starred item, in one query. */
export async function listStarredKeys(): Promise<Set<string>> {
  const rows = await db()
    .select({ type: itemStars.itemType, id: itemStars.itemId })
    .from(itemStars);
  return new Set(rows.map((r) => refKey({ type: r.type, id: r.id })));
}

export async function isStarred(ref: ItemRef): Promise<boolean> {
  assertItemRef(ref);
  const rows = await db()
    .select({ id: itemStars.itemId })
    .from(itemStars)
    .where(and(eq(itemStars.itemType, ref.type), eq(itemStars.itemId, ref.id)))
    .limit(1);
  return rows.length > 0;
}

/** Stars or unstars an existing item (idempotent). Throws `not_found` for a missing item. */
export async function setStarred(ref: ItemRef, starred: boolean): Promise<void> {
  assertItemRef(ref);
  await withTx(async (tx) => {
    if (!starred) {
      await tx
        .delete(itemStars)
        .where(and(eq(itemStars.itemType, ref.type), eq(itemStars.itemId, ref.id)));
      return;
    }
    if (!(await exists(ref, tx))) throw new RepoError("not_found", "항목을 찾을 수 없습니다.");
    await tx
      .insert(itemStars)
      .values({ itemType: ref.type, itemId: ref.id, createdAt: nowIso() })
      .onConflictDoNothing();
  });
}
