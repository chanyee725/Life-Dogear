import { and, asc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { areas, goals, links, projects } from "@/db/schema";
import { getHeads, refKey } from "./items";
import { removeLinksFor, syncBodyLinks } from "./links";
import {
  archiveFilter,
  db,
  definedOnly,
  hasTag,
  newId,
  nowIso,
  RepoError,
  requireTitle,
  trimText,
  withTx,
  type ArchiveOptions,
  type Executor,
  type ItemRef,
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
export type AreaListOptions = ArchiveOptions & { tag?: string };

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
    .where(
      and(
        archiveFilter(areas.archivedAt, options),
        options.tag ? hasTag(db(), "area", areas.id, options.tag) : undefined,
      ),
    )
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

export type SkippedArea = { title: string; archived: boolean };

const titleKey = (title: string) => title.normalize("NFC").trim().toLowerCase();

/**
 * Creates the areas whose titles don't exist yet (case-insensitive), in one serialized
 * transaction so concurrent calls can't create duplicates. Existing titles are
 * reported in `skipped`; `archived: true` means the match is in the archive.
 */
export async function createMissing(
  inputs: readonly AreaInput[],
): Promise<{ created: Area[]; skipped: SkippedArea[] }> {
  const { ids, skipped } = await withTx(async (tx) => {
    const existing = new Map(
      (await tx.select({ title: areas.title, archivedAt: areas.archivedAt }).from(areas)).map(
        (a) => [titleKey(a.title), a.archivedAt !== null] as const,
      ),
    );
    const ids: string[] = [];
    const skipped: SkippedArea[] = [];
    for (const input of inputs) {
      const key = titleKey(input.title);
      const archived = existing.get(key);
      if (archived !== undefined) {
        skipped.push({ title: input.title, archived });
        continue;
      }
      ids.push(await createWith(tx, input));
      existing.set(key, false);
    }
    return { ids, skipped };
  });
  const all = await list({ includeArchived: true });
  return { created: ids.map((id) => all.find((a) => a.id === id)!), skipped };
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
  if (input.body) await syncBodyLinks(exec, ref(id), input.body);
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
    if (patch.body !== undefined) await syncBodyLinks(tx, ref(id), patch.body);
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

/**
 * Area a goal counts toward: its own, else (left empty) its parent's, recursively.
 * Only a goal that names another area leaves its area's subtree.
 */
export function effectiveAreas(
  list: readonly { id: string; parentId: string | null; areaId: string | null }[],
): Map<string, string | null> {
  const byId = new Map(list.map((g) => [g.id, g]));
  const out = new Map<string, string | null>();
  const resolve = (id: string, seen: Set<string>): string | null => {
    if (out.has(id)) return out.get(id)!;
    const g = byId.get(id);
    if (!g) return null;
    const area =
      g.areaId ?? (g.parentId && !seen.has(g.parentId) ? resolve(g.parentId, seen.add(id)) : null);
    out.set(id, area);
    return area;
  };
  for (const g of list) resolve(g.id, new Set());
  return out;
}

// ---------------------------------------------------------------------------
// Material (논문·세미나·생각) around an area

export type MaterialType = "paper" | "seminar" | "thought";
const MATERIAL_TYPES: readonly string[] = ["paper", "seminar", "thought"];

/** Where a material is linked from: the area itself, or one of its projects or goals. */
export type MaterialVia =
  { type: "area" } | { type: "project" | "goal"; id: string; title: string };

export type AreaMaterial = {
  ref: ItemRef & { type: MaterialType };
  title: string;
  /** Direct link first, then projects and goals by title; never empty. */
  via: MaterialVia[];
};

const typeOrder = (t: string) => MATERIAL_TYPES.indexOf(t);

/**
 * Papers, seminars and thoughts linked to the area, to its goals (own or inherited
 * from the parent, see {@link effectiveAreas}), to its projects or to area-less projects
 * working toward its goals (non-archived on both ends), one entry per item with every
 * path that reaches it. Fixed query count: goals, projects, links, then one title query
 * per material type.
 */
export async function listMaterials(areaId: string): Promise<AreaMaterial[]> {
  // Goals count toward the area by the inheritance rule (non-archived chain only).
  const liveGoals = await db()
    .select({ id: goals.id, title: goals.title, parentId: goals.parentId, areaId: goals.areaId })
    .from(goals)
    .where(isNull(goals.archivedAt));
  const areaOf = effectiveAreas(liveGoals);
  const areaGoals = liveGoals.filter((g) => areaOf.get(g.id) === areaId);
  // The area's projects, plus area-less projects working toward one of its goals.
  const goalIds = areaGoals.map((g) => g.id);
  const areaProjects = await db()
    .select({ id: projects.id, title: projects.title })
    .from(projects)
    .where(
      and(
        isNull(projects.archivedAt),
        or(
          eq(projects.areaId, areaId),
          goalIds.length
            ? and(isNull(projects.areaId), inArray(projects.goalId, goalIds))
            : undefined,
        ),
      ),
    );

  const sources = new Map<string, MaterialVia>([[refKey(ref(areaId)), { type: "area" }]]);
  for (const p of areaProjects) sources.set(`project:${p.id}`, { type: "project", ...p });
  for (const g of areaGoals)
    sources.set(`goal:${g.id}`, { type: "goal", id: g.id, title: g.title });

  const side = (type: "area" | "project" | "goal", ids: string[]): SQL[] =>
    ids.length
      ? [
          and(eq(links.sourceType, type), inArray(links.sourceId, ids))!,
          and(eq(links.targetType, type), inArray(links.targetId, ids))!,
        ]
      : [];
  const rows = await db()
    .select()
    .from(links)
    .where(
      or(
        ...side("area", [areaId]),
        ...side(
          "project",
          areaProjects.map((p) => p.id),
        ),
        ...side(
          "goal",
          areaGoals.map((g) => g.id),
        ),
      ),
    );

  const found = new Map<string, { ref: AreaMaterial["ref"]; via: MaterialVia[] }>();
  for (const l of rows) {
    const pairs: [string, ItemRef][] = [
      [`${l.sourceType}:${l.sourceId}`, { type: l.targetType, id: l.targetId }],
      [`${l.targetType}:${l.targetId}`, { type: l.sourceType, id: l.sourceId }],
    ];
    for (const [sourceKey, other] of pairs) {
      const via = sources.get(sourceKey);
      if (!via || !MATERIAL_TYPES.includes(other.type)) continue;
      const entry = found.get(refKey(other)) ?? {
        ref: other as AreaMaterial["ref"],
        via: [],
      };
      if (!entry.via.includes(via)) entry.via.push(via);
      found.set(refKey(other), entry);
    }
  }

  const heads = await getHeads([...found.values()].map((e) => e.ref));
  const viaRank = (v: MaterialVia) => (v.type === "area" ? "" : `${v.type}:${v.title}`);
  return [...found.values()]
    .flatMap((e) => {
      const head = heads.get(refKey(e.ref));
      if (!head || head.archived) return [];
      const via = [...e.via].sort((a, b) => viaRank(a).localeCompare(viaRank(b), "ko"));
      return [{ ref: e.ref, title: head.title, via }];
    })
    .sort(
      (a, b) =>
        typeOrder(a.ref.type) - typeOrder(b.ref.type) || a.title.localeCompare(b.title, "ko"),
    );
}
