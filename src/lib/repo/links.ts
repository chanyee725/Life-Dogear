import { and, desc, eq, or } from "drizzle-orm";
import { graphLayout, links } from "@/db/schema";
import { exists, getHeads, refKey, type ItemSummary } from "./items";
import {
  assertItemRef,
  db,
  newId,
  nowIso,
  RepoError,
  type Executor,
  type ItemRef,
  withTx,
  serializeWrite,
} from "./shared";

export type Link = typeof links.$inferSelect;

const sameRef = (a: ItemRef, b: ItemRef) => a.type === b.type && a.id === b.id;

const between = (a: ItemRef, b: ItemRef) =>
  or(
    and(
      eq(links.sourceType, a.type),
      eq(links.sourceId, a.id),
      eq(links.targetType, b.type),
      eq(links.targetId, b.id),
    ),
    and(
      eq(links.sourceType, b.type),
      eq(links.sourceId, b.id),
      eq(links.targetType, a.type),
      eq(links.targetId, a.id),
    ),
  );

const touching = (ref: ItemRef) =>
  or(
    and(eq(links.sourceType, ref.type), eq(links.sourceId, ref.id)),
    and(eq(links.targetType, ref.type), eq(links.targetId, ref.id)),
  );

/**
 * Links `a` (source) → `b` (target) by hand. Idempotent: if the pair is already linked
 * in either direction, that link is kept; a `body` link is promoted to `manual` so
 * removing the `[[…]]` from the body no longer removes it.
 */
export async function link(a: ItemRef, b: ItemRef): Promise<Link> {
  assertItemRef(a);
  assertItemRef(b);
  if (sameRef(a, b)) throw new RepoError("invalid", "자기 자신과는 연결할 수 없습니다.");

  return withTx(async (tx) => {
    if (!(await exists(a, tx)) || !(await exists(b, tx))) {
      throw new RepoError("not_found", "연결할 항목을 찾을 수 없습니다.");
    }
    const [existing] = await tx.select().from(links).where(between(a, b)).limit(1);
    if (existing) {
      if (existing.via === "manual") return existing;
      await tx.update(links).set({ via: "manual" }).where(eq(links.id, existing.id));
      return { ...existing, via: "manual" };
    }

    const row: Link = {
      id: newId(),
      sourceType: a.type,
      sourceId: a.id,
      targetType: b.type,
      targetId: b.id,
      via: "manual",
      createdAt: nowIso(),
    };
    await tx.insert(links).values(row);
    return row;
  });
}

/** Removes the link between `a` and `b`, whichever direction it was created in. */
export async function unlink(a: ItemRef, b: ItemRef): Promise<boolean> {
  assertItemRef(a);
  assertItemRef(b);
  const deleted = await serializeWrite(() =>
    db().delete(links).where(between(a, b)).returning({ id: links.id }),
  );
  return deleted.length > 0;
}

/** Items connected to `ref` in either direction, newest link first; archived ones flagged. */
export async function listConnected(ref: ItemRef): Promise<ItemSummary[]> {
  assertItemRef(ref);
  const rows = await db().select().from(links).where(touching(ref)).orderBy(desc(links.createdAt));
  const others: ItemRef[] = rows.map((l) =>
    l.sourceType === ref.type && l.sourceId === ref.id
      ? { type: l.targetType, id: l.targetId }
      : { type: l.sourceType, id: l.sourceId },
  );
  const heads = await getHeads(others);
  return others.flatMap((o) => {
    const head = heads.get(refKey(o));
    return head ? [{ ref: o, type: o.type, title: head.title, archived: head.archived }] : [];
  });
}

/**
 * Delete-time clean-up of an item's connections: its links and its pinned graph
 * position. Every repo `remove` calls this inside its transaction.
 */
export async function removeLinksFor(exec: Executor, ref: ItemRef): Promise<void> {
  await exec.delete(links).where(touching(ref));
  await exec
    .delete(graphLayout)
    .where(and(eq(graphLayout.nodeType, ref.type), eq(graphLayout.nodeId, ref.id)));
}
