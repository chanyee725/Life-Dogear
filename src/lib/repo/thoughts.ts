import { and, asc, desc, eq, notExists, or, sql, type SQL } from "drizzle-orm";
import { itemTags, links, thoughts } from "@/db/schema";
import {
  THOUGHT_KIND,
  THOUGHT_MATURITY,
  type ThoughtKind,
  type ThoughtMaturity,
} from "@/lib/enums";
import { removeLinksFor } from "./links";
import {
  db,
  definedOnly,
  hasTag,
  newId,
  nowIso,
  requireEnum,
  requireTitle,
  type Executor,
  orderFor,
  withTx,
  archiveFilter,
  type ArchiveOptions,
} from "./shared";
import { getTagsFor, removeTagsFor, setTagsWith } from "./tags";

export type Thought = typeof thoughts.$inferSelect & { tags: string[] };

export type ThoughtInput = {
  title: string;
  kind?: ThoughtKind;
  maturity?: ThoughtMaturity;
  body?: string;
  tags?: string[];
};
export type ThoughtPatch = Partial<ThoughtInput>;

export type ThoughtSort = "updated" | "created" | "title";
export type ThoughtListOptions = ArchiveOptions & {
  tag?: string;
  kind?: ThoughtKind;
  maturity?: ThoughtMaturity;
  sort?: ThoughtSort;
};

const ORDER: Record<ThoughtSort, SQL[]> = {
  updated: [desc(thoughts.updatedAt)],
  created: [desc(thoughts.createdAt)],
  title: [asc(thoughts.title)],
};

const ref = (id: string) => ({ type: "thought" as const, id });

async function withTags(rows: (typeof thoughts.$inferSelect)[], exec: Executor = db()) {
  const tagMap = await getTagsFor(
    "thought",
    rows.map((r) => r.id),
    exec,
  );
  return rows.map((r) => ({ ...r, tags: tagMap.get(r.id) ?? [] }));
}

function toColumns(input: ThoughtPatch) {
  return definedOnly({
    title: input.title === undefined ? undefined : requireTitle(input.title),
    kind: input.kind === undefined ? undefined : requireEnum(THOUGHT_KIND, input.kind, "종류"),
    maturity:
      input.maturity === undefined
        ? undefined
        : requireEnum(THOUGHT_MATURITY, input.maturity, "발전 정도"),
    body: input.body,
  });
}

/** Non-archived by default; see {@link ArchiveOptions}. */
export async function list(options: ThoughtListOptions = {}): Promise<Thought[]> {
  const where: (SQL | undefined)[] = [archiveFilter(thoughts.archivedAt, options)];
  if (options.kind) where.push(eq(thoughts.kind, options.kind));
  if (options.maturity) where.push(eq(thoughts.maturity, options.maturity));
  if (options.tag) where.push(hasTag(db(), "thought", thoughts.id, options.tag));
  const rows = await db()
    .select()
    .from(thoughts)
    .where(and(...where))
    .orderBy(...orderFor(ORDER, options.sort, "updated"));
  return withTags(rows);
}

/** Newest thoughts first (home dashboard). */
export async function listRecent(limit = 5): Promise<Thought[]> {
  const rows = await db()
    .select()
    .from(thoughts)
    .where(archiveFilter(thoughts.archivedAt))
    .orderBy(...ORDER.created)
    .limit(limit);
  return withTags(rows);
}

export async function get(id: string): Promise<Thought | null> {
  const [row] = await db().select().from(thoughts).where(eq(thoughts.id, id));
  return row ? (await withTags([row]))[0] : null;
}

export async function create(input: ThoughtInput): Promise<Thought> {
  const now = nowIso();
  const id = newId();
  await withTx(async (tx) => {
    await tx.insert(thoughts).values({
      id,
      title: requireTitle(input.title),
      ...toColumns({ ...input, title: undefined, tags: undefined }),
      createdAt: now,
      updatedAt: now,
    });
    if (input.tags) await setTagsWith(tx, ref(id), input.tags);
  });
  return (await get(id))!;
}

export async function update(id: string, patch: ThoughtPatch): Promise<Thought | null> {
  const found = await withTx(async (tx) => {
    const updated = await tx
      .update(thoughts)
      .set({ ...toColumns({ ...patch, tags: undefined }), updatedAt: nowIso() })
      .where(eq(thoughts.id, id))
      .returning({ id: thoughts.id });
    if (!updated.length) return false;
    if (patch.tags) await setTagsWith(tx, ref(id), patch.tags);
    return true;
  });
  return found ? get(id) : null;
}

export async function remove(id: string): Promise<boolean> {
  return withTx(async (tx) => {
    const deleted = await tx
      .delete(thoughts)
      .where(eq(thoughts.id, id))
      .returning({ id: thoughts.id });
    if (!deleted.length) return false;
    await removeLinksFor(tx, ref(id));
    await removeTagsFor(tx, ref(id));
    return true;
  });
}

/** Inbox: thoughts not archived, with no tags and no links in either direction. */
function inboxWhere(): SQL {
  const linked = db()
    .select({ one: sql`1` })
    .from(links)
    .where(
      or(
        and(eq(links.sourceType, "thought"), eq(links.sourceId, thoughts.id)),
        and(eq(links.targetType, "thought"), eq(links.targetId, thoughts.id)),
      ),
    );
  const tagged = db()
    .select({ one: sql`1` })
    .from(itemTags)
    .where(and(eq(itemTags.itemType, "thought"), eq(itemTags.itemId, thoughts.id)));
  return and(archiveFilter(thoughts.archivedAt), notExists(linked), notExists(tagged))!;
}

/** Thoughts waiting to be organized (수집함), newest first. Tagging or linking files them. */
export async function listInbox(limit?: number): Promise<Thought[]> {
  const query = db()
    .select()
    .from(thoughts)
    .where(inboxWhere())
    .orderBy(...ORDER.created);
  return withTags(limit ? await query.limit(limit) : await query);
}

export async function countInbox(): Promise<number> {
  const [row] = await db()
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(thoughts)
    .where(inboxWhere());
  return row.n;
}
