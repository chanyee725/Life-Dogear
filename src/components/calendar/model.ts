/**
 * Calendar layout (docs/PLAN-CALENDAR.md 1절). Pure; safe on server and client.
 * Dates are `YYYY-MM-DD` in Asia/Seoul. Weeks start on Monday (same as `isoWeekRange`).
 */
import { addDays } from "@/components/tasks/format";
import type { CalendarItem, CalendarSource } from "@/lib/calendar/types";

export const CALENDAR_TZ = "Asia/Seoul";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isDate = (v: unknown): v is string => {
  if (typeof v !== "string" || !DATE_RE.test(v)) return false;
  const t = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === v;
};

const seoulDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: CALENDAR_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const seoulTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: CALENDAR_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Seoul calendar date of an instant. */
export function seoulDate(at: Date | string = new Date()): string {
  return seoulDay.format(typeof at === "string" ? new Date(at) : at);
}

/** Day an item falls on: all-day dates as written, timed ISO instants in Seoul. */
export function dayOf(value: string): string {
  return DATE_RE.test(value) ? value : seoulDate(value);
}

/** `HH:MM` in Seoul for timed items, null for all-day. */
export function timeOf(item: Pick<CalendarItem, "allDay" | "start">): string | null {
  if (item.allDay || DATE_RE.test(item.start)) return null;
  return seoulTime.format(new Date(item.start));
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return (new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay() + 6) % 7;
}

export const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;

export const startOfWeek = (date: string) => addDays(date, -weekdayIndex(date));

/** Same day `n` months later, clamped to the month's last day. */
export function addMonths(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const first = new Date(Date.UTC(y!, m! - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d!, last));
  return first.toISOString().slice(0, 10);
}

export type CalendarRangeKind = "month" | "week";

/** The days a view shows: whole weeks covering the month, or one week. */
export function gridWeeks(kind: CalendarRangeKind, date: string): string[][] {
  if (kind === "week") {
    const from = startOfWeek(date);
    return [Array.from({ length: 7 }, (_, i) => addDays(from, i))];
  }
  const first = `${date.slice(0, 7)}-01`;
  const last = addDays(addMonths(first, 1), -1);
  const weeks: string[][] = [];
  for (let from = startOfWeek(first); from <= last; from = addDays(from, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(from, i)));
  }
  return weeks;
}

export function gridRange(kind: CalendarRangeKind, date: string): { from: string; to: string } {
  const weeks = gridWeeks(kind, date);
  return { from: weeks[0]![0]!, to: weeks.at(-1)![6]! };
}

/** Date of the previous/next page (`dir` = -1 or 1). */
export const stepDate = (kind: CalendarRangeKind, date: string, dir: -1 | 1) =>
  kind === "week" ? addDays(date, 7 * dir) : addMonths(date, dir);

/** Heading: `2026년 11월` or `2026년 11월 2일 – 8일` (week). */
export function rangeTitle(kind: CalendarRangeKind, date: string): string {
  const [y, m] = date.split("-").map(Number);
  if (kind === "month") return `${y}년 ${m}월`;
  const { from, to } = gridRange("week", date);
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  if (fy !== ty) return `${fy}년 ${fm}월 ${fd}일 – ${ty}년 ${tm}월 ${td}일`;
  if (fm !== tm) return `${fy}년 ${fm}월 ${fd}일 – ${tm}월 ${td}일`;
  return `${fy}년 ${fm}월 ${fd}일 – ${td}일`;
}

/** Spoken date: `11월 4일 수요일`. */
export function spokenDay(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}월 ${d}일 ${WEEKDAYS[weekdayIndex(date)]}요일`;
}

// ---- query ----------------------------------------------------------------------------

export type CalendarQuery = {
  view: "list" | "calendar";
  range: CalendarRangeKind;
  /** Anchor date (defaults to today). */
  date: string;
  papers: boolean;
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseCalendarQuery(
  params: Record<string, string | string[] | undefined>,
  today: string,
): CalendarQuery {
  const date = one(params.date);
  return {
    view: one(params.view) === "calendar" ? "calendar" : "list",
    range: one(params.range) === "week" ? "week" : "month",
    date: isDate(date) ? date : today,
    papers: one(params.papers) === "1",
  };
}

/** URL of a calendar page; defaults are left out (`range=month`, today, papers off). */
export function calendarHref(
  q: Partial<Omit<CalendarQuery, "view">>,
  today?: string,
): string {
  const sp = new URLSearchParams({ view: "calendar" });
  if (q.range === "week") sp.set("range", "week");
  if (q.date && q.date !== today) sp.set("date", q.date);
  if (q.papers) sp.set("papers", "1");
  return `/tasks?${sp}`;
}

// ---- layout ---------------------------------------------------------------------------

/** Items with a later last day than first day are drawn as bars (띠). */
export function lastDay(item: CalendarItem): string {
  const first = dayOf(item.start);
  if (!item.end) return first;
  const end = dayOf(item.end);
  return end > first ? end : first;
}

export const isBar = (item: CalendarItem) => lastDay(item) !== dayOf(item.start);

/** Source order inside a day: deadlines first, reading last, Google after app items. */
const SOURCE_ORDER: Record<CalendarSource, number> = {
  task: 0,
  project: 1,
  seminar: 2,
  goal: 3,
  review: 4,
  paper: 5,
  google: 6,
};

export function compareItems(a: CalendarItem, b: CalendarItem): number {
  // All-day before timed, then by time, then source, then title.
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  if (!a.allDay && a.start !== b.start) return a.start < b.start ? -1 : 1;
  return (
    SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source] ||
    Number(!!a.done) - Number(!!b.done) ||
    a.title.localeCompare(b.title, "ko")
  );
}

export type WeekBar = {
  item: CalendarItem;
  /** 0-based column of the first visible day and how many columns it covers. */
  col: number;
  span: number;
  lane: number;
  /** The bar goes on before/after this week. */
  continuesBefore: boolean;
  continuesAfter: boolean;
};

export type WeekLayout = {
  days: string[];
  bars: WeekBar[];
  lanes: number;
  /** Single-day items per day (same order as `days`), sorted. */
  singles: CalendarItem[][];
};

/** Bars packed into lanes (longest first) and single-day items per day for one week. */
export function layoutWeek(items: readonly CalendarItem[], days: readonly string[]): WeekLayout {
  const from = days[0]!;
  const to = days.at(-1)!;
  const singles = days.map(() => [] as CalendarItem[]);
  const barItems: { item: CalendarItem; first: string; last: string }[] = [];
  for (const item of items) {
    const first = dayOf(item.start);
    const last = lastDay(item);
    if (last < from || first > to) continue;
    if (first === last) singles[days.indexOf(first)]?.push(item);
    else barItems.push({ item, first, last });
  }
  barItems.sort(
    (a, b) =>
      a.first.localeCompare(b.first) ||
      b.last.localeCompare(a.last) ||
      compareItems(a.item, b.item),
  );
  const laneEnds: number[] = [];
  const bars: WeekBar[] = barItems.map(({ item, first, last }) => {
    const col = first < from ? 0 : days.indexOf(first);
    const end = last > to ? days.length - 1 : days.indexOf(last);
    let lane = laneEnds.findIndex((e) => e < col);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = end;
    return {
      item,
      col,
      span: end - col + 1,
      lane,
      continuesBefore: first < from,
      continuesAfter: last > to,
    };
  });
  for (const list of singles) list.sort(compareItems);
  return { days: [...days], bars, lanes: laneEnds.length, singles };
}

/** First `max` items and how many are left over ("+n"). Shows all when only one would hide. */
export function splitOverflow<T>(list: readonly T[], max: number): { shown: T[]; hidden: number } {
  if (list.length <= max) return { shown: [...list], hidden: 0 };
  const keep = Math.max(0, max - 1);
  return { shown: list.slice(0, keep), hidden: list.length - keep };
}

/** Per-day counts for the home strip; bars count on every day they cover. */
export function countByDay(
  items: readonly CalendarItem[],
  days: readonly string[],
): Map<string, CalendarItem[]> {
  const out = new Map(days.map((d) => [d, [] as CalendarItem[]]));
  for (const item of items) {
    const first = dayOf(item.start);
    const last = lastDay(item);
    for (const d of days) if (d >= first && d <= last) out.get(d)!.push(item);
  }
  for (const list of out.values()) list.sort(compareItems);
  return out;
}

/** Moves a task item to `date` (optimistic drag/keyboard update). */
export function moveItemTo(items: readonly CalendarItem[], id: string, date: string): CalendarItem[] {
  return items.map((it) => (it.id === id ? { ...it, start: date, end: undefined } : it));
}
