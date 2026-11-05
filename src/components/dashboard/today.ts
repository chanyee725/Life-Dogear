/**
 * Pure helpers for the home "오늘" screen (PLAN-TODAY 3절, docs/design/today.md 4절):
 * the rest of the week, this quarter's goals and the stars to revisit. No DB, no clock.
 */
import { seoulDate, spokenDay } from "@/components/calendar/model";
import { addDays } from "@/components/tasks/format";
import { neglectedImportant, type ScoredNode } from "@/lib/cosmos/score";
import type { CosmosScores } from "@/lib/cosmos/types";
import { ITEM_ROUTE, ITEM_TYPE, type ItemType } from "@/lib/enums";
import { parseGraphNodeId } from "@/lib/graph/types";
import type { GoalNode } from "@/lib/repo/goals";

/** Section caps (4.1). */
export const TODAY_MAX = 8;
export const WEEK_MAX = 5;
export const GOALS_MAX = 4;
export const STARS_MAX = 3;

/**
 * "이번 주": tomorrow through Sunday of this ISO (Monday-first) week, inclusive
 * `YYYY-MM-DD`. Null on Sunday — nothing is left of the week.
 */
export function restOfWeek(today: string): { from: string; to: string } | null {
  const [y, m, d] = today.split("-").map(Number);
  const weekday = ((new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay() + 6) % 7) + 1; // 1 Mon … 7 Sun
  if (weekday === 7) return null;
  return { from: addDays(today, 1), to: addDays(today, 7 - weekday) };
}

export type QuarterGoal = {
  id: string;
  title: string;
  progress: number | null;
  /** What the progress counts ("프로젝트 1/3", "할 일 2/5"); null for manual progress. */
  basis: string | null;
};

/** Active, non-archived quarter goals of `quarter` (e.g. `2026-Q4`) in tree order. */
export function quarterGoalNodes(tree: readonly GoalNode[], quarter: string): GoalNode[] {
  const out: GoalNode[] = [];
  const walk = (nodes: readonly GoalNode[]) => {
    for (const n of nodes) {
      const g = n.goal;
      if (
        g.horizon === "quarter" &&
        g.period === quarter &&
        g.status === "active" &&
        !g.archivedAt
      ) {
        out.push(n);
      }
      walk(n.children);
    }
  };
  walk(tree);
  return out;
}

/** Same rule as `computeProgress`: projects first, then the goal's own tasks, else manual. */
export function quarterGoal(
  node: GoalNode,
  taskCount: { done: number; total: number } | undefined,
): QuarterGoal {
  const { goal, projects } = node;
  let basis: string | null = null;
  if (goal.progressMode !== "manual") {
    if (projects.length) {
      basis = `프로젝트 ${projects.filter((p) => p.done).length}/${projects.length}`;
    } else if (taskCount?.total) {
      basis = `할 일 ${taskCount.done}/${taskCount.total}`;
    }
  }
  return { id: goal.id, title: goal.title, progress: node.progress, basis };
}

export type RevisitStar = {
  type: ItemType;
  id: string;
  title: string;
  href: string;
  lastActiveAt: string | null;
};

/**
 * "다시 볼 별": the cosmos panel's rule for 오래 손대지 않은 중요한 별 (`neglectedImportant`:
 * score ≥ `NEGLECTED_MIN_SCORE`, untouched for more than `NEGLECTED_MIN_DAYS`), but highest
 * score first and at most `STARS_MAX`.
 */
export function revisitStars(data: CosmosScores, now: Date, limit = STARS_MAX): RevisitStar[] {
  const scored: ScoredNode[] = [];
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  for (const n of data.nodes) {
    const info = data.cosmos[n.id];
    if (!info) continue;
    scored.push({
      id: n.id,
      type: n.type,
      score: info.score,
      direct: info.direct,
      centrality: info.centrality,
      recency: info.recency,
      starred: info.starred,
      lastActiveAt: info.lastActiveAt,
      degree: n.size,
    });
  }
  const out: RevisitStar[] = [];
  const picked = neglectedImportant(scored, now, Infinity).sort(
    (a, b) => b.score - a.score || (a.id < b.id ? -1 : 1),
  );
  for (const s of picked) {
    const ref = parseGraphNodeId(s.id);
    if (!ref || !ITEM_TYPE.is(ref.type)) continue;
    out.push({
      type: ref.type,
      id: ref.id,
      title: byId.get(s.id)!.title,
      href: `${ITEM_ROUTE[ref.type]}/${encodeURIComponent(ref.id)}`,
      lastActiveAt: s.lastActiveAt,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** Date line for a Seoul day (`YYYY-MM-DD`), e.g. `11월 3일 화요일`. */
export function todayHeading(today: string): string {
  return spokenDay(today);
}

/**
 * The home's "today" in Asia/Seoul, whatever the server's zone (Vercel runs in UTC, so a
 * local date is a day behind from 00:00 to 09:00 KST). `day` is local midnight of that
 * Seoul date, for helpers that read a `Date`'s local parts (review periods).
 */
export function seoulToday(now: Date): { today: string; day: Date } {
  const today = seoulDate(now);
  const [y, m, d] = today.split("-").map(Number);
  return { today, day: new Date(y!, m! - 1, d!) };
}

/**
 * Home project cards' context line: the linked goal's title, else the area's. Goal titles
 * come from the already-loaded goal tree and area titles from one area list, so the home
 * loader stays at a fixed query count. Unknown or archived targets are left out.
 */
export function projectContext(
  projects: readonly { id: string; goalId: string | null; areaId: string | null }[],
  goalTree: readonly GoalNode[],
  areas: readonly { id: string; title: string }[],
): Record<string, string> {
  const goalTitle = new Map<string, string>();
  const walk = (nodes: readonly GoalNode[]) => {
    for (const n of nodes) {
      goalTitle.set(n.goal.id, n.goal.title);
      walk(n.children);
    }
  };
  walk(goalTree);
  const areaTitle = new Map(areas.map((a) => [a.id, a.title]));
  const out: Record<string, string> = {};
  for (const p of projects) {
    const title =
      (p.goalId ? goalTitle.get(p.goalId) : undefined) ??
      (p.areaId ? areaTitle.get(p.areaId) : undefined);
    if (title) out[p.id] = title;
  }
  return out;
}

/** `tasks.countFor` result (keyed `"project:id"`) re-keyed by project id. */
export function projectProgress(
  projectIds: readonly string[],
  counts: Readonly<Record<string, { done: number; total: number }>>,
): Record<string, { done: number; total: number }> {
  const out: Record<string, { done: number; total: number }> = {};
  for (const id of projectIds) {
    const c = counts[`project:${id}`];
    if (c) out[id] = c;
  }
  return out;
}
