/**
 * Today panel "다음 일정" (calendar.md 13.3). Pure; safe on server and client.
 * Dates are Seoul `YYYY-MM-DD`; timed items are ISO instants.
 */
import { addDays } from "@/components/tasks/format";
import type { CalendarItem, CalendarSource } from "@/lib/calendar/types";
import { WEEKDAYS, compareItems, dayOf, isOneDay, timeOf, weekdayIndex } from "./model";

/** Rows the panel lists at most (13.3). */
export const UPCOMING_MAX = 10;

/**
 * Single-day sources the list draws from (goals, reviews are periods; papers are past reads;
 * tasks and project deadlines are not calendar items).
 */
const UPCOMING_SOURCES: ReadonlySet<CalendarSource> = new Set(["seminar", "google"]);

export type UpcomingGroup = { day: string; items: CalendarItem[] };

export type Upcoming = {
  groups: UpcomingGroup[];
  /** Rows shown (≤ `UPCOMING_MAX`). */
  shown: number;
  /** Matching items past the limit ("이후 n개는 달력에서"). */
  more: number;
};

/** Timed before untimed, by time; untimed in the cell order (3.2). */
function compareInDay(a: CalendarItem, b: CalendarItem): number {
  const ta = timeOf(a);
  const tb = timeOf(b);
  if (ta && tb) return a.start.localeCompare(b.start) || compareItems(a, b);
  if (ta || tb) return ta ? -1 : 1;
  return compareItems(a, b);
}

/** Whether a timed item on today has already ended (its end, else its start, is before `now`). */
function isOver(item: CalendarItem, now: string): boolean {
  if (!timeOf(item)) return false;
  const end = item.end && !/^\d{4}-\d{2}-\d{2}$/.test(item.end) ? item.end : item.start;
  return new Date(end).getTime() < new Date(now).getTime();
}

/**
 * What is left from `day` on: open single-day items in time order, grouped by day. On
 * `today` timed events that are already over are dropped ("그날 남은 것"); done tasks stay
 * only on `day` itself (struck through), not on later days.
 */
export function upcoming(
  items: readonly CalendarItem[],
  day: string,
  today: string,
  now: string,
): Upcoming {
  const list = items
    .filter(
      (it) =>
        UPCOMING_SOURCES.has(it.source) &&
        isOneDay(it) &&
        (!it.done || dayOf(it.start) === day) &&
        dayOf(it.start) >= day &&
        !(dayOf(it.start) === today && isOver(it, now)),
    )
    .sort((a, b) => dayOf(a.start).localeCompare(dayOf(b.start)) || compareInDay(a, b));
  const head = list.slice(0, UPCOMING_MAX);
  const groups: UpcomingGroup[] = [];
  for (const it of head) {
    const d = dayOf(it.start);
    const last = groups.at(-1);
    if (last?.day === d) last.items.push(it);
    else groups.push({ day: d, items: [it] });
  }
  return { groups, shown: head.length, more: list.length - head.length };
}

/** "오늘" / "내일" / null relative to `today`. */
export function relativeDay(day: string, today: string): "오늘" | "내일" | null {
  if (day === today) return "오늘";
  if (day === addDays(today, 1)) return "내일";
  return null;
}

/** Group heading: "오늘", "내일", else "11월 6일(금)". */
export function groupHeading(day: string, today: string): string {
  const rel = relativeDay(day, today);
  if (rel) return rel;
  const [, m, d] = day.split("-").map(Number);
  return `${m}월 ${d}일(${WEEKDAYS[weekdayIndex(day)]})`;
}

/** Right column of a row: the task's parent, "마감", "세미나", "Google". */
export function originLabel(item: CalendarItem): string {
  switch (item.source) {
    case "task":
      return item.parent ?? "";
    case "project":
      return "마감";
    case "seminar":
      return "세미나";
    case "google":
      return "Google";
    default:
      return "";
  }
}
