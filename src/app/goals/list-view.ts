import { seoulDate } from "@/components/calendar/model";
import type { GoalHorizon, GoalStatus } from "@/lib/enums";

/**
 * The 목표 list (`/goals`) as plain data: active life goals as the "방향" line, active
 * year/quarter goals grouped by area (year → quarter inside), and achieved/dropped goals
 * apart in one flat "끝난 목표" list. Pure, so the grouping and filters are testable.
 */

/** The fields of a goal tree node this view needs (a `GoalNode` fits). */
export type GoalTreeInput = {
  goal: {
    id: string;
    title: string;
    horizon: GoalHorizon;
    period: string | null;
    status: GoalStatus;
    areaId: string | null;
  };
  progress: number | null;
  projects: readonly unknown[];
  children: readonly GoalTreeInput[];
};

/** One row of the list; small and serializable (passed to the client list). */
export type ListGoal = {
  id: string;
  title: string;
  horizon: GoalHorizon;
  period: string | null;
  status: GoalStatus;
  progress: number | null;
  projectCount: number;
  /** Effective area (own, else the parent goal's); null = none or unknown. */
  areaId: string | null;
  children: ListGoal[];
};

export type GoalGroup = {
  /** Area id; null = "영역 없음". */
  areaId: string | null;
  title: string;
  goals: ListGoal[];
};

export type PeriodFilter =
  | { kind: "quarter"; period: string }
  | { kind: "year"; year: string; current: boolean }
  | { kind: "all" };

/** `?area=none` keeps goals without an area. */
export const NO_AREA = "none";
export const NO_AREA_TITLE = "영역 없음";

/**
 * Current quarter/year as `2026-Q4` / `2026`, by the Seoul date (as the days-left labels),
 * not the server's time zone.
 */
function nowPeriods(now: Date) {
  const [year = "", month = "1"] = seoulDate(now).split("-");
  return { year, quarter: `${year}-Q${Math.floor((Number(month) - 1) / 3) + 1}` };
}

/**
 * `?period=`: `quarter` (default, also for unknown values) → this quarter, `year` → this
 * year, `2027` → that year, `all` → everything.
 */
export function parsePeriodFilter(param: string | undefined, now = new Date()): PeriodFilter {
  const { year, quarter } = nowPeriods(now);
  if (param === "all") return { kind: "all" };
  if (param === "year") return { kind: "year", year, current: true };
  if (param && /^\d{4}$/.test(param)) return { kind: "year", year: param, current: param === year };
  return { kind: "quarter", period: quarter };
}

/** The `?period=` value for a filter (`undefined` for the default, this quarter). */
export function periodParam(filter: PeriodFilter): string | undefined {
  if (filter.kind === "quarter") return undefined;
  if (filter.kind === "all") return "all";
  return filter.current ? "year" : filter.year;
}

/** "이번 분기(2026-Q4)", "올해(2026)", "2027년", "전체 기간". */
export function periodLabel(filter: PeriodFilter): string {
  if (filter.kind === "quarter") return `이번 분기(${filter.period})`;
  if (filter.kind === "all") return "전체 기간";
  return filter.current ? `올해(${filter.year})` : `${filter.year}년`;
}

/**
 * Years with goals other than the current one, ascending (the "다른 연도" select).
 * `shown`: the other year being viewed, kept even without goals (e.g. `?period=2030`).
 */
export function otherYears(
  forest: readonly GoalTreeInput[],
  now = new Date(),
  shown?: string | null,
): string[] {
  const current = nowPeriods(now).year;
  const years = new Set<string>(shown && shown !== current ? [shown] : []);
  const walk = (nodes: readonly GoalTreeInput[]) => {
    for (const n of nodes) {
      const y = n.goal.period?.slice(0, 4);
      if (y && y !== current) years.add(y);
      walk(n.children);
    }
  };
  walk(forest);
  return [...years].sort();
}

/** Whether the goal's own period falls in the filter (life goals only in "전체"). */
export function inPeriod(period: string | null, filter: PeriodFilter): boolean {
  if (filter.kind === "all") return true;
  if (!period) return false;
  if (filter.kind === "quarter")
    return period === filter.period || period === filter.period.slice(0, 4);
  return period.slice(0, 4) === filter.year;
}

type Flat = {
  node: GoalTreeInput;
  /** Own area, else the parent's (as `areas.effectiveAreas`). */
  areaId: string | null;
  parentId: string | null;
};

function flatten(forest: readonly GoalTreeInput[]): Flat[] {
  const out: Flat[] = [];
  const walk = (nodes: readonly GoalTreeInput[], parent: Flat | null) => {
    for (const node of nodes) {
      const flat: Flat = {
        node,
        areaId: node.goal.areaId ?? parent?.areaId ?? null,
        parentId: parent?.node.goal.id ?? null,
      };
      out.push(flat);
      walk(node.children, flat);
    }
  };
  walk(forest, null);
  return out;
}

const toRow = ({ node: n, areaId }: Flat, children: ListGoal[] = []): ListGoal => ({
  id: n.goal.id,
  title: n.goal.title,
  horizon: n.goal.horizon,
  period: n.goal.period,
  status: n.goal.status,
  progress: n.progress,
  projectCount: n.projects.length,
  areaId,
  children,
});

/** Newest period first; life goals (no period) last; then title. */
function byPeriodDesc(a: ListGoal, b: ListGoal): number {
  if (a.period !== b.period) {
    if (!a.period) return 1;
    if (!b.period) return -1;
    // "2026-Q4" before "2026" (the year itself sorts after its quarters).
    const ka = a.period.length === 4 ? `${a.period}-Q0` : a.period;
    const kb = b.period.length === 4 ? `${b.period}-Q0` : b.period;
    return kb.localeCompare(ka);
  }
  return a.title.localeCompare(b.title, "ko");
}

export type GoalListView = {
  /** Active life goals (the "방향" line); not filtered. */
  direction: ListGoal[];
  /** Active year/quarter goals by area, in the given area order, "영역 없음" last. */
  groups: GoalGroup[];
  /** Achieved and dropped goals in the filters, newest period first. */
  ended: ListGoal[];
};

/**
 * Builds the list from the goal forest (as `goals.listTree()` returns it).
 * - Period: a goal is in when its own period fits; an active year goal also comes in as
 *   the parent of an active quarter goal that is in (same area only).
 * - Area (`areaId`, or {@link NO_AREA}): by effective area (own, else the parent's).
 * - A quarter goal sits under its year goal when that one is shown in the same group;
 *   otherwise (ended, other area, out of the period) it stands on its own.
 * `areas` gives the group order and titles; goals of unknown areas go to "영역 없음".
 */
export function buildGoalList(
  forest: readonly GoalTreeInput[],
  areas: readonly { id: string; title: string }[],
  filters: { period: PeriodFilter; areaId?: string },
): GoalListView {
  const known = new Set(areas.map((a) => a.id));
  const flat = flatten(forest).map((f) => ({
    ...f,
    areaId: f.areaId && known.has(f.areaId) ? f.areaId : null,
  }));
  const areaOk = (areaId: string | null) =>
    !filters.areaId || (filters.areaId === NO_AREA ? areaId === null : areaId === filters.areaId);

  const direction = flat
    .filter((f) => f.node.goal.horizon === "life" && f.node.goal.status === "active")
    .map((f) => toRow(f));

  const ended = flat
    .filter(
      (f) =>
        f.node.goal.status !== "active" &&
        areaOk(f.areaId) &&
        inPeriod(f.node.goal.period, filters.period),
    )
    .map((f) => toRow(f))
    .sort(byPeriodDesc);

  const active = flat.filter(
    (f) => f.node.goal.horizon !== "life" && f.node.goal.status === "active" && areaOk(f.areaId),
  );
  const shown = new Map<string, (typeof active)[number]>();
  for (const f of active) {
    if (inPeriod(f.node.goal.period, filters.period)) shown.set(f.node.goal.id, f);
  }
  // Year goals come in as the parent of a shown quarter goal in the same area.
  const byId = new Map(active.map((f) => [f.node.goal.id, f]));
  for (const f of [...shown.values()]) {
    const parent = f.parentId ? byId.get(f.parentId) : undefined;
    if (parent && parent.areaId === f.areaId) shown.set(parent.node.goal.id, parent);
  }

  // Rows per area, sorted like the goal list (year → quarter, period, title).
  const childRows = new Map<string, ListGoal[]>();
  const nested = new Set<string>();
  for (const f of shown.values()) {
    const parent = f.parentId ? shown.get(f.parentId) : undefined;
    if (parent && parent.areaId === f.areaId && parent.node.goal.horizon !== "life") {
      const siblings = childRows.get(parent.node.goal.id) ?? [];
      childRows.set(parent.node.goal.id, [...siblings, toRow(f)].sort(byLevelPeriodTitle));
      nested.add(f.node.goal.id);
    }
  }
  const roots = [...shown.values()]
    .filter((f) => !nested.has(f.node.goal.id))
    .sort((a, b) => byLevelPeriodTitle(a.node.goal, b.node.goal));
  const groupRows = new Map<string | null, ListGoal[]>();
  for (const f of roots) {
    const row = toRow(f, childRows.get(f.node.goal.id) ?? []);
    groupRows.set(f.areaId, [...(groupRows.get(f.areaId) ?? []), row]);
  }

  const groups: GoalGroup[] = [];
  for (const a of areas) {
    const goals = groupRows.get(a.id);
    if (goals?.length) groups.push({ areaId: a.id, title: a.title, goals });
  }
  const loose = groupRows.get(null);
  if (loose?.length) groups.push({ areaId: null, title: NO_AREA_TITLE, goals: loose });

  return { direction, groups, ended };
}

const HORIZON_RANK: Record<GoalHorizon, number> = { life: 0, year: 1, quarter: 2 };

/** Year goals before quarter goals that stand alone, then period and title (as `goals.list`). */
function byLevelPeriodTitle(
  a: { horizon: GoalHorizon; period: string | null; title: string },
  b: { horizon: GoalHorizon; period: string | null; title: string },
): number {
  return (
    HORIZON_RANK[a.horizon] - HORIZON_RANK[b.horizon] ||
    (a.period ?? "").localeCompare(b.period ?? "") ||
    a.title.localeCompare(b.title, "ko")
  );
}

/** Goals in a group (all levels) and their average progress (null if none measured). */
export function groupStats(goals: readonly ListGoal[]): { count: number; average: number | null } {
  const all = goals.flatMap((g) => [g, ...g.children]);
  const values = all.map((g) => g.progress).filter((p): p is number => p !== null);
  return {
    count: all.length,
    average: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null,
  };
}

/** "달성 9 · 내려놓음 3" counts of the ended list. */
export function endedCounts(ended: readonly ListGoal[]): { achieved: number; dropped: number } {
  return {
    achieved: ended.filter((g) => g.status === "achieved").length,
    dropped: ended.filter((g) => g.status === "dropped").length,
  };
}

const normalize = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();

/** Title contains the query (case- and space-insensitive); blank query matches all. */
export function titleMatches(title: string, query: string): boolean {
  const q = normalize(query);
  return !q || normalize(title).includes(q);
}

/**
 * Text filter over the groups: a goal that matches keeps all its sub-goals; otherwise it
 * stays only for its matching sub-goals. Empty groups drop out.
 */
export function filterGroupsByText(groups: readonly GoalGroup[], query: string): GoalGroup[] {
  if (!normalize(query)) return [...groups];
  return groups
    .map((group) => ({
      ...group,
      goals: group.goals.flatMap((g) => {
        if (titleMatches(g.title, query)) return [g];
        const children = g.children.filter((c) => titleMatches(c.title, query));
        return children.length ? [{ ...g, children }] : [];
      }),
    }))
    .filter((group) => group.goals.length > 0);
}

/**
 * The filters narrowing the list, in words, for the "nothing here" message:
 * e.g. ["이번 분기(2026-Q4)", "건강 영역", "‘논문’ 검색"]. "전체 기간" is no filter.
 */
export function filterLabels(filters: {
  period: PeriodFilter;
  areaTitle?: string;
  query?: string;
}): string[] {
  const out: string[] = [];
  if (filters.period.kind !== "all") out.push(periodLabel(filters.period));
  if (filters.areaTitle) {
    out.push(filters.areaTitle === NO_AREA_TITLE ? NO_AREA_TITLE : `${filters.areaTitle} 영역`);
  }
  const q = filters.query?.trim();
  if (q) out.push(`‘${q}’ 검색`);
  return out;
}

/** Areas that have any goal in the view (for the area select), in the given order. */
export function areasWithGoals<A extends { id: string }>(
  view: GoalListView,
  areas: readonly A[],
): A[] {
  const ids = new Set<string | null>();
  for (const g of [...view.direction, ...view.ended]) ids.add(g.areaId);
  for (const group of view.groups) ids.add(group.areaId);
  return areas.filter((a) => ids.has(a.id));
}

/** Whether the view has goals without an area (offer "영역 없음" in the select). */
export function hasGoalsWithoutArea(view: GoalListView): boolean {
  return (
    view.groups.some((g) => g.areaId === null) ||
    [...view.direction, ...view.ended].some((g) => g.areaId === null)
  );
}

/** Last day of a period: `2026` → 2026-12-31, `2026-Q2` → 2026-06-30; null otherwise. */
export function periodEnd(period: string | null): string | null {
  const m = /^(\d{4})(?:-Q([1-4]))?$/.exec(period ?? "");
  if (!m) return null;
  const year = Number(m[1]);
  const month = m[2] ? Number(m[2]) * 3 : 12;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${m[1]}-${String(month).padStart(2, "0")}-${last}`;
}

/** Days left to the period's end: "D-12", "D-day", "끝남" when past; null without a period. */
export function dueLabel(period: string | null, today: string): string | null {
  const end = periodEnd(period);
  if (!end) return null;
  const days = Math.round((Date.parse(end) - Date.parse(today)) / 86_400_000);
  if (days < 0) return "끝남";
  return days === 0 ? "D-day" : `D-${days}`;
}
