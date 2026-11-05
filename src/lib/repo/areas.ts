import { and, asc, eq, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { areas, goals, links, notes, projects, tasks } from "@/db/schema";
import { getHeads, refKey, tableFor } from "./items";
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

export type GoalHead = {
  id: string;
  title: string;
  parentId: string | null;
  areaId: string | null;
};

/**
 * Non-archived goals with the area each counts toward ({@link effectiveAreas}; an
 * archived parent breaks the chain). One query.
 */
export async function liveGoalAreas(
  exec: Executor = db(),
): Promise<{ goals: GoalHead[]; areaOf: Map<string, string | null> }> {
  const list = await exec
    .select({ id: goals.id, title: goals.title, parentId: goals.parentId, areaId: goals.areaId })
    .from(goals)
    .where(isNull(goals.archivedAt));
  return { goals: list, areaOf: effectiveAreas(list) };
}

/** The goals (from {@link liveGoalAreas}) that count toward `areaId`. */
export const goalsOfArea = (
  live: { goals: GoalHead[]; areaOf: Map<string, string | null> },
  areaId: string,
): GoalHead[] => live.goals.filter((g) => live.areaOf.get(g.id) === areaId);

/**
 * Projects of an area: its own, plus area-less projects working toward one of its
 * goals (`areaGoals`, from {@link goalsOfArea}). Archive state is left to the caller.
 */
export function inAreaWhere(areaId: string, areaGoals: readonly { id: string }[]): SQL {
  const goalIds = areaGoals.map((g) => g.id);
  return or(
    eq(projects.areaId, areaId),
    goalIds.length ? and(isNull(projects.areaId), inArray(projects.goalId, goalIds)) : undefined,
  )!;
}

/**
 * Area a project counts toward by the rule of {@link inAreaWhere}: its own area, else the
 * area of the goal it works toward (`areaOf` from {@link liveGoalAreas}).
 */
export const projectArea = (
  p: { areaId: string | null; goalId: string | null },
  areaOf: ReadonlyMap<string, string | null>,
): string | null => p.areaId ?? (p.goalId ? (areaOf.get(p.goalId) ?? null) : null);

// ---------------------------------------------------------------------------
// Material (논문·세미나·생각) around an area. Notes are not material: the area's 노트
// section shows them.

export type MaterialType = "paper" | "seminar" | "thought";
const MATERIAL_TYPES: readonly string[] = ["paper", "seminar", "thought"];

/** How a material reaches the area: linked to the area itself, or to one of its projects or goals. */
export type MaterialVia =
  { type: "area" } | { type: "project" | "goal"; id: string; title: string };

export type AreaMaterial = {
  ref: ItemRef & { type: MaterialType };
  title: string;
  /** Direct link, then projects and goals by title; never empty. */
  via: MaterialVia[];
};

const typeOrder = (t: string) => MATERIAL_TYPES.indexOf(t);

/**
 * Papers, seminars and thoughts linked to the area, to its goals (own or inherited from the
 * parent, see {@link effectiveAreas}), to its projects or to area-less projects working toward
 * its goals (non-archived on both ends), one entry per item with every path that reaches it.
 * Fixed query count: goals, projects, links, then one title query per material type.
 */
export async function listMaterials(areaId: string): Promise<AreaMaterial[]> {
  const areaGoals = goalsOfArea(await liveGoalAreas(), areaId);
  const areaProjects = await db()
    .select({ id: projects.id, title: projects.title })
    .from(projects)
    .where(and(isNull(projects.archivedAt), inAreaWhere(areaId, areaGoals)));

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
  const viaRank = (v: MaterialVia) => (v.type === "area" ? "1" : `2${v.type}:${v.title}`);
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

// ---------------------------------------------------------------------------
// Indirect (2-step) connections for the area's "연결된 항목"

export type IndirectItem = {
  ref: ItemRef;
  title: string;
  updatedAt: string;
  /** The first-step item it was reached through. */
  via: ItemRef & { title: string };
};

/**
 * Items two steps from the area: linked to something that is linked to the area or belongs
 * to it (its projects and goals, see {@link inAreaWhere}). Skips the area, its projects,
 * goals and own notes, items already linked to the area, and archived items. Newest
 * `updatedAt` first, at most `limit`, one entry per item. Fixed query count.
 */
export async function listIndirect(areaId: string, limit = 6): Promise<IndirectItem[]> {
  const self = ref(areaId);
  const areaGoals = goalsOfArea(await liveGoalAreas(), areaId);
  const [areaProjects, areaNotes, directRows] = await Promise.all([
    db()
      .select({ id: projects.id, archivedAt: projects.archivedAt })
      .from(projects)
      .where(inAreaWhere(areaId, areaGoals)),
    db().select({ id: notes.id }).from(notes).where(eq(notes.areaId, areaId)),
    db()
      .select()
      .from(links)
      .where(
        or(
          and(eq(links.sourceType, "area"), eq(links.sourceId, areaId)),
          and(eq(links.targetType, "area"), eq(links.targetId, areaId)),
        ),
      ),
  ]);
  const direct: ItemRef[] = directRows.map((l) =>
    l.sourceType === "area" && l.sourceId === areaId
      ? { type: l.targetType, id: l.targetId }
      : { type: l.sourceType, id: l.sourceId },
  );

  const excluded = new Set<string>([refKey(self)]);
  for (const p of areaProjects) excluded.add(`project:${p.id}`);
  for (const g of areaGoals) excluded.add(`goal:${g.id}`);
  for (const n of areaNotes) excluded.add(`note:${n.id}`);
  for (const d of direct) excluded.add(refKey(d));

  const firstStep = new Map<string, ItemRef>();
  for (const d of direct) firstStep.set(refKey(d), d);
  for (const p of areaProjects)
    if (!p.archivedAt) firstStep.set(`project:${p.id}`, { type: "project", id: p.id });
  for (const g of areaGoals) firstStep.set(`goal:${g.id}`, { type: "goal", id: g.id });
  if (firstStep.size === 0) return [];

  const byType = new Map<string, string[]>();
  for (const r of firstStep.values()) byType.set(r.type, [...(byType.get(r.type) ?? []), r.id]);
  const side = [...byType].flatMap(([type, ids]) => [
    and(eq(links.sourceType, type as ItemRef["type"]), inArray(links.sourceId, ids))!,
    and(eq(links.targetType, type as ItemRef["type"]), inArray(links.targetId, ids))!,
  ]);
  const rows = await db()
    .select()
    .from(links)
    .where(or(...side));

  // other → first-step item it came through (first one found wins)
  const found = new Map<string, { ref: ItemRef; via: ItemRef }>();
  for (const l of rows) {
    const s = { type: l.sourceType, id: l.sourceId };
    const t = { type: l.targetType, id: l.targetId };
    for (const [from, other] of [
      [s, t],
      [t, s],
    ] as const) {
      if (!firstStep.has(refKey(from))) continue;
      const key = refKey(other);
      if (excluded.has(key) || found.has(key)) continue;
      found.set(key, { ref: other, via: from });
    }
  }
  if (found.size === 0) return [];

  const entries = [...found.values()];
  const heads = await getHeads([...entries.map((e) => e.ref), ...entries.map((e) => e.via)]);
  const updated = new Map<string, string>();
  const idsByType = new Map<ItemRef["type"], string[]>();
  for (const e of entries)
    idsByType.set(e.ref.type, [...(idsByType.get(e.ref.type) ?? []), e.ref.id]);
  for (const [type, ids] of idsByType) {
    const t = tableFor(type);
    const got = await db()
      .select({ id: t.id, updatedAt: t.updatedAt })
      .from(t)
      .where(inArray(t.id, ids));
    for (const r of got) updated.set(`${type}:${r.id}`, r.updatedAt);
  }

  return entries
    .flatMap((e) => {
      const head = heads.get(refKey(e.ref));
      const viaHead = heads.get(refKey(e.via));
      const updatedAt = updated.get(refKey(e.ref));
      if (!head || head.archived || !viaHead || !updatedAt) return [];
      return [
        { ref: e.ref, title: head.title, updatedAt, via: { ...e.via, title: viaHead.title } },
      ];
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Care signal: when each area was last touched, and what is still open in it

export type AreaCare = {
  /** Latest `updatedAt` of the area, its projects, goals and their tasks (ISO). */
  lastActivity: string;
  /** Non-archived projects not done (counted like {@link inAreaWhere}). */
  openProjects: number;
  /** Non-archived goals in progress that count toward the area ({@link effectiveAreas}). */
  activeGoals: number;
  /** Open tasks on the area itself, its projects or its goals. */
  openTasks: number;
  /** Non-archived notes whose `areaId` is the area. Not part of `lastActivity`. */
  notes: number;
};

export type CareSource = {
  areas: readonly { id: string; updatedAt: string }[];
  goals: readonly {
    id: string;
    parentId: string | null;
    areaId: string | null;
    status: string;
    updatedAt: string;
  }[];
  projects: readonly {
    id: string;
    areaId: string | null;
    goalId: string | null;
    status: string;
    updatedAt: string;
  }[];
  /** Tasks grouped by parent: latest `updatedAt` and the open count. */
  tasks: readonly {
    parentType: string | null;
    parentId: string | null;
    lastUpdated: string | null;
    open: number;
  }[];
  /** Non-archived notes grouped by area: how many each has. */
  notes?: readonly { areaId: string | null; count: number }[];
};

/** Pure part of {@link listCare}: folds goals, projects and tasks into their areas. */
export function summarizeCare(src: CareSource): Map<string, AreaCare> {
  const out = new Map<string, AreaCare>(
    src.areas.map((a) => [
      a.id,
      { lastActivity: a.updatedAt, openProjects: 0, activeGoals: 0, openTasks: 0, notes: 0 },
    ]),
  );
  const touch = (areaId: string | null | undefined, at: string | null) => {
    const care = areaId ? out.get(areaId) : undefined;
    if (care && at && at > care.lastActivity) care.lastActivity = at;
    return care;
  };
  const areaOf = effectiveAreas(src.goals);
  for (const g of src.goals) {
    const care = touch(areaOf.get(g.id), g.updatedAt);
    if (care && g.status === "active") care.activeGoals++;
  }
  const projectAreas = new Map<string, string | null>();
  for (const p of src.projects) {
    const area = projectArea(p, areaOf);
    projectAreas.set(p.id, area);
    const care = touch(area, p.updatedAt);
    if (care && p.status !== "done") care.openProjects++;
  }
  for (const t of src.tasks) {
    if (!t.parentId) continue;
    const area =
      t.parentType === "area"
        ? t.parentId
        : t.parentType === "project"
          ? projectAreas.get(t.parentId)
          : t.parentType === "goal"
            ? areaOf.get(t.parentId)
            : undefined;
    const care = touch(area, t.lastUpdated);
    if (care) care.openTasks += Number(t.open);
  }
  for (const n of src.notes ?? []) {
    const care = n.areaId ? out.get(n.areaId) : undefined;
    if (care) care.notes += Number(n.count);
  }
  return out;
}

/**
 * {@link AreaCare} for every non-archived area, keyed by id. Archived projects and goals
 * (and their tasks) don't count. Five queries, run together; no per-area queries.
 */
export async function listCare(): Promise<Map<string, AreaCare>> {
  const exec = db();
  const [areaRows, goalRows, projectRows, taskRows, noteRows] = await Promise.all([
    exec
      .select({ id: areas.id, updatedAt: areas.updatedAt })
      .from(areas)
      .where(isNull(areas.archivedAt)),
    exec
      .select({
        id: goals.id,
        parentId: goals.parentId,
        areaId: goals.areaId,
        status: goals.status,
        updatedAt: goals.updatedAt,
      })
      .from(goals)
      .where(isNull(goals.archivedAt)),
    exec
      .select({
        id: projects.id,
        areaId: projects.areaId,
        goalId: projects.goalId,
        status: projects.status,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .where(isNull(projects.archivedAt)),
    exec
      .select({
        parentType: tasks.parentType,
        parentId: tasks.parentId,
        lastUpdated: sql<string | null>`max(${tasks.updatedAt})`,
        open: sql<number>`sum(case when ${tasks.doneAt} is null then 1 else 0 end)`,
      })
      .from(tasks)
      .where(isNotNull(tasks.parentType))
      .groupBy(tasks.parentType, tasks.parentId),
    exec
      .select({ areaId: notes.areaId, count: sql<number>`count(*)` })
      .from(notes)
      .where(and(isNull(notes.archivedAt), isNotNull(notes.areaId)))
      .groupBy(notes.areaId),
  ]);
  return summarizeCare({
    areas: areaRows,
    goals: goalRows,
    projects: projectRows,
    tasks: taskRows,
    notes: noteRows,
  });
}
