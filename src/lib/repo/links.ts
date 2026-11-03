import { and, desc, eq, or } from "drizzle-orm";
import { graphLayout, links } from "@/db/schema";
import { extractWikiTitles, renameWikiTitle } from "@/lib/wikilinks";
import {
  exists,
  getBody,
  getHeads,
  refKey,
  resolveTitles,
  tableFor,
  type ItemSummary,
} from "./items";
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
export function link(a: ItemRef, b: ItemRef): Promise<Link> {
  return withTx((tx) => linkWith(tx, a, b));
}

/** {@link link} inside an open transaction. */
export async function linkWith(tx: Executor, a: ItemRef, b: ItemRef): Promise<Link> {
  assertItemRef(a);
  assertItemRef(b);
  if (sameRef(a, b)) throw new RepoError("invalid", "자기 자신과는 연결할 수 없습니다.");
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

// ---------------------------------------------------------------------------
// `[[title]]` body links
//
// One link per pair (either direction), `manual` wins:
// - a pair that is already linked (manual or body, either direction) is left alone;
// - only `via = 'body'` rows created from this item's body (source = item) are ever
//   removed, and only when the body no longer links the other item;
// - if the other item's body still links back, the row is turned around instead of
//   being deleted, so it stays owned by a body that mentions it.

const otherSide = (row: Link, ref: ItemRef): ItemRef =>
  row.sourceType === ref.type && row.sourceId === ref.id
    ? { type: row.targetType, id: row.targetId }
    : { type: row.sourceType, id: row.sourceId };

/** Items the body links to with `[[…]]` (resolved, self excluded). */
async function bodyTargets(exec: Executor, ref: ItemRef, body: string): Promise<ItemRef[]> {
  const resolved = await resolveTitles(extractWikiTitles(body), exec);
  const out = new Map<string, ItemRef>();
  for (const s of resolved.values()) if (!sameRef(s.ref, ref)) out.set(refKey(s.ref), s.ref);
  return [...out.values()];
}

async function bodyLinksTo(exec: Executor, from: ItemRef, to: ItemRef): Promise<boolean> {
  const body = await getBody(from, exec);
  if (!body) return false;
  return (await bodyTargets(exec, from, body)).some((t) => sameRef(t, to));
}

/**
 * Brings `links` in line with the `[[…]]` links in `body` (the item's saved body).
 * Call inside the transaction that saves the body.
 */
export async function syncBodyLinks(exec: Executor, ref: ItemRef, body: string): Promise<void> {
  assertItemRef(ref);
  const targets = await bodyTargets(exec, ref, body);
  const wanted = new Set(targets.map(refKey));
  const rows = await exec.select().from(links).where(touching(ref));
  const linked = new Set(rows.map((r) => refKey(otherSide(r, ref))));

  for (const target of targets) {
    if (linked.has(refKey(target))) continue;
    await exec
      .insert(links)
      .values({
        id: newId(),
        sourceType: ref.type,
        sourceId: ref.id,
        targetType: target.type,
        targetId: target.id,
        via: "body",
        createdAt: nowIso(),
      })
      .onConflictDoNothing();
  }

  for (const row of rows) {
    const mine = row.via === "body" && row.sourceType === ref.type && row.sourceId === ref.id;
    if (!mine) continue;
    const other = otherSide(row, ref);
    if (wanted.has(refKey(other))) continue;
    if (await bodyLinksTo(exec, other, ref)) {
      await exec
        .update(links)
        .set({
          sourceType: other.type,
          sourceId: other.id,
          targetType: ref.type,
          targetId: ref.id,
        })
        .where(and(eq(links.id, row.id), eq(links.via, "body")));
    } else {
      await exec.delete(links).where(and(eq(links.id, row.id), eq(links.via, "body")));
    }
  }
}

/** Linked items whose body has `[[oldTitle]]` (live, outside code and quotes). */
async function mentionsOf(exec: Executor, ref: ItemRef, oldTitle: string) {
  const rows = await exec.select().from(links).where(touching(ref));
  const out: { ref: ItemRef; body: string; count: number }[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const other = otherSide(row, ref);
    if (seen.has(refKey(other))) continue;
    seen.add(refKey(other));
    const body = await getBody(other, exec);
    if (!body) continue;
    const { count } = renameWikiTitle(body, oldTitle, oldTitle);
    if (count) out.push({ ref: other, body, count });
  }
  return out;
}

/** How many linked items still write `[[oldTitle]]` for `ref` (for the rename prompt). */
export async function countTitleMentions(ref: ItemRef, oldTitle: string): Promise<number> {
  assertItemRef(ref);
  return (await mentionsOf(db(), ref, oldTitle)).length;
}

/**
 * After `ref` was renamed: rewrites `[[oldTitle]]` → `[[newTitle]]` in the bodies of
 * linked items. Their `updatedAt` is bumped. Returns the items changed.
 */
export async function renameTitleMentions(
  ref: ItemRef,
  oldTitle: string,
  newTitle: string,
): Promise<ItemRef[]> {
  assertItemRef(ref);
  return withTx(async (tx) => {
    const changed: ItemRef[] = [];
    for (const m of await mentionsOf(tx, ref, oldTitle)) {
      const { body, count } = renameWikiTitle(m.body, oldTitle, newTitle);
      if (!count) continue;
      const t = tableFor(m.ref.type);
      await tx.update(t).set({ body, updatedAt: nowIso() }).where(eq(t.id, m.ref.id));
      changed.push(m.ref);
    }
    return changed;
  });
}

/** Re-runs body link sync from the stored body (e.g. after a `[[title]]` target was created). */
export async function resyncBody(ref: ItemRef): Promise<boolean> {
  assertItemRef(ref);
  return withTx(async (tx) => {
    const body = await getBody(ref, tx);
    if (body === null) return false;
    await syncBodyLinks(tx, ref, body);
    return true;
  });
}
