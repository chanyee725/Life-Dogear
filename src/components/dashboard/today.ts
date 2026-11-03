/**
 * Pure helpers for the home "오늘" screen (PLAN-TODAY 3절): local calendar days, the rest
 * of the week, this quarter's goals and the cosmos panel's neglected stars. No DB, no clock
 * (pass `today`).
 */
import type { CosmosResponse } from "@/lib/cosmos/types";
import { ITEM_ROUTE, ITEM_TYPE, type ItemType } from "@/lib/enums";
import { parseGraphNodeId } from "@/lib/graph/types";
import type { GoalNode } from "@/lib/repo/goals";
import { periodOf } from "@/lib/reviews/period";

const pad = (n: number) => String(n).padStart(2, "0");

/** `YYYY-MM-DD` of a local date (task due dates are calendar days). */
export const localYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/**
 * "이번 주 마감": tomorrow through Sunday of this (ISO, Monday-first) week, inclusive.
 * Null on Sunday — the rest of the week is empty.
 */
export function restOfWeek(today: Date): { from: string; to: string } | null {
  const weekday = ((today.getDay() + 6) % 7) + 1; // 1 Mon .. 7 Sun
  if (weekday === 7) return null;
  return { from: localYmd(addDays(today, 1)), to: localYmd(addDays(today, 7 - weekday)) };
}

/** Whole calendar days from `due` (`YYYY-MM-DD`) to `today`; positive when overdue. */
export function daysOverdue(due: string, today: Date): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(due);
  if (!m) return 0;
  const a = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const b = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((b - a) / 86_400_000);
}

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

/** `11.6 (목)` for a due date this week. */
export function shortDue(due: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(due);
  if (!m) return due;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${d.getMonth() + 1}.${d.getDate()} (${WEEKDAY[d.getDay()]})`;
}

export type QuarterGoal = { id: string; title: string; progress: number | null };

/** Active (non-archived) goals of this quarter, in tree order, with their progress. */
export function quarterGoals(tree: readonly GoalNode[], today: Date): QuarterGoal[] {
  const quarter = periodOf("quarter", today);
  const out: QuarterGoal[] = [];
  const walk = (nodes: readonly GoalNode[]) => {
    for (const n of nodes) {
      const g = n.goal;
      if (g.horizon === "quarter" && g.period === quarter && g.status === "active" && !g.archivedAt) {
        out.push({ id: g.id, title: g.title, progress: n.progress });
      }
      walk(n.children);
    }
  };
  walk(tree);
  return out;
}

export type NeglectedStar = {
  type: ItemType;
  id: string;
  title: string;
  href: string;
  lastActiveAt: string | null;
};

/**
 * The cosmos panel's "오래 손대지 않은 중요한 별" (same list, same order: score ≥ 0.55,
 * untouched 45+ days, oldest first), resolved to titles and detail routes.
 */
export function neglectedStars(cosmos: Pick<CosmosResponse, "nodes" | "cosmos" | "neglected">) {
  const byId = new Map(cosmos.nodes.map((n) => [n.id, n]));
  const out: NeglectedStar[] = [];
  for (const nodeId of cosmos.neglected) {
    const node = byId.get(nodeId);
    const ref = parseGraphNodeId(nodeId);
    if (!node || !ref || !ITEM_TYPE.is(ref.type)) continue;
    out.push({
      type: ref.type,
      id: ref.id,
      title: node.title,
      href: `${ITEM_ROUTE[ref.type]}/${encodeURIComponent(ref.id)}`,
      lastActiveAt: cosmos.cosmos[nodeId]?.lastActiveAt ?? null,
    });
  }
  return out;
}

/** Where a task's row links: its parent's detail screen, or `/tasks` for unfiled ones. */
export function taskParentHref(task: { parentType: string | null; parentId: string | null }) {
  if (task.parentId && (task.parentType === "project" || task.parentType === "goal" || task.parentType === "area")) {
    return `${ITEM_ROUTE[task.parentType]}/${encodeURIComponent(task.parentId)}`;
  }
  return "/tasks";
}
