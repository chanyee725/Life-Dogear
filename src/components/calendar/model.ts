/**
 * Calendar layout (docs/PLAN-CALENDAR.md 1절). Pure; safe on server and client.
 * Dates are `YYYY-MM-DD` in Asia/Seoul. Weeks start on Monday (same as `isoWeekRange`).
 */
import { addDays } from "@/components/tasks/format";
import type { CalendarItem } from "@/lib/calendar/types";

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

/** `2w`: two weeks from the anchor's Monday (default view); `month`: whole weeks of the month. */
export type CalendarRangeKind = "2w" | "month";

/** Days a 2-week page shows. */
export const TWO_WEEKS = 14;

/** The days a view shows: whole weeks covering the month, or two weeks from Monday. */
export function gridWeeks(kind: CalendarRangeKind, date: string): string[][] {
  if (kind === "2w") {
    const from = startOfWeek(date);
    return [0, 7].map((o) => Array.from({ length: 7 }, (_, i) => addDays(from, o + i)));
  }
  const first = `${date.slice(0, 7)}-01`;
  const last = addDays(addMonths(first, 1), -1);
  const weeks: string[][] = [];
  for (let from = startOfWeek(first); from <= last; from = addDays(from, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(from, i)));
  }
  return weeks;
}

/** Monday..Sunday of the week holding `date` (home strip). */
export const weekDays = (date: string) =>
  Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(date), i));

/**
 * Range the calendar page loads: from the grid's first day as far as one request may go
 * (`MAX_RANGE_DAYS` = 93), so the today panel can look ahead past the grid without a second call.
 */
export function fetchRange(kind: CalendarRangeKind, date: string): { from: string; to: string } {
  const from = gridRange(kind, date).from;
  return { from, to: addDays(from, FETCH_DAYS - 1) };
}
export const FETCH_DAYS = 93;

export function gridRange(kind: CalendarRangeKind, date: string): { from: string; to: string } {
  const weeks = gridWeeks(kind, date);
  return { from: weeks[0]![0]!, to: weeks.at(-1)![6]! };
}

/** Date of the previous/next page (`dir` = -1 or 1). */
export const stepDate = (kind: CalendarRangeKind, date: string, dir: -1 | 1) =>
  kind === "2w" ? addDays(date, TWO_WEEKS * dir) : addMonths(date, dir);

/** Heading: `2026년 11월`, or for two weeks `11월 2일 – 15일` / `10월 26일 – 11월 8일`. */
export function rangeTitle(kind: CalendarRangeKind, date: string): string {
  const [y, m] = date.split("-").map(Number);
  if (kind === "month") return `${y}년 ${m}월`;
  const { from, to } = gridRange(kind, date);
  const [, fm, fd] = from.split("-").map(Number);
  const [, tm, td] = to.split("-").map(Number);
  return fm === tm ? `${fm}월 ${fd}일 – ${td}일` : `${fm}월 ${fd}일 – ${tm}월 ${td}일`;
}

/** Days the page is "about": the month (1st..last) or the week; period-line test uses it. */
export function visibleSpan(kind: CalendarRangeKind, date: string): { from: string; to: string } {
  if (kind === "2w") return gridRange("2w", date);
  const from = `${date.slice(0, 7)}-01`;
  return { from, to: addDays(addMonths(from, 1), -1) };
}

/** Spoken date: `11월 4일 수요일`. */
export function spokenDay(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}월 ${d}일 ${WEEKDAYS[weekdayIndex(date)]}요일`;
}

/** `11월 5일` (no weekday). */
export function shortDay(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}월 ${d}일`;
}

// ---- query ----------------------------------------------------------------------------

export type CalendarQuery = {
  view: "list" | "calendar";
  range: CalendarRangeKind;
  /** Anchor date (defaults to today). */
  date: string;
  /** Day the today panel is about (defaults to today). */
  day: string;
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Old `range=week` links (and anything unknown) open the 2-week view. */
export function parseCalendarQuery(
  params: Record<string, string | string[] | undefined>,
  today: string,
): CalendarQuery {
  const date = one(params.date);
  const day = one(params.day);
  return {
    view: one(params.view) === "calendar" ? "calendar" : "list",
    range: one(params.range) === "month" ? "month" : "2w",
    date: isDate(date) ? date : today,
    day: isDate(day) ? day : today,
  };
}

/** URL of a calendar page; defaults are left out (`range=2w`, today). */
export function calendarHref(
  q: { range?: CalendarRangeKind; date?: string; day?: string },
  today?: string,
) {
  const sp = new URLSearchParams({ view: "calendar" });
  if (q.range === "month") sp.set("range", "month");
  if (q.date && q.date !== today) sp.set("date", q.date);
  if (q.day && q.day !== today) sp.set("day", q.day);
  return `/tasks?${sp}`;
}

// ---- ordering -------------------------------------------------------------------------

/** Last day an item covers (inclusive). */
export function lastDay(item: CalendarItem): string {
  const first = dayOf(item.start);
  if (!item.end) return first;
  const end = dayOf(item.end);
  return end > first ? end : first;
}

/** Single-day item (not a period): the only kind counted in dots (8절·9절). */
export const isOneDay = (item: CalendarItem) => lastDay(item) === dayOf(item.start);

/** Can be dragged / moved with `[` `]`: open tasks only (calendar.md 5.1). */
export const isMovable = (item: CalendarItem) => !!item.taskId && !item.done;

/**
 * Order inside a day (calendar.md 3.2): project → seminar → open task → (goal, review) →
 * Google (all-day, then by time) → paper → done task; then title.
 */
export function rankOf(item: CalendarItem): number {
  switch (item.source) {
    case "project":
      return 0;
    case "seminar":
      return 1;
    case "task":
      return item.done ? 7 : 2;
    case "goal":
      return 3;
    case "review":
      return 4;
    case "google":
      return 5;
    case "paper":
      return 6;
  }
}

export function compareItems(a: CalendarItem, b: CalendarItem): number {
  const r = rankOf(a) - rankOf(b);
  if (r) return r;
  if (a.source === "google") {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    if (!a.allDay && a.start !== b.start) return a.start < b.start ? -1 : 1;
  }
  return a.title.localeCompare(b.title, "ko");
}

/** Items on `day` (bars included), sorted. */
export function itemsOn(items: readonly CalendarItem[], day: string): CalendarItem[] {
  return items.filter((it) => dayOf(it.start) <= day && day <= lastDay(it)).sort(compareItems);
}

// ---- layout ---------------------------------------------------------------------------

/** Items covering the whole visible span go on the period line above the grid (3.3). */
export function splitPeriodLine(
  items: readonly CalendarItem[],
  span: { from: string; to: string },
): { line: CalendarItem[]; rest: CalendarItem[] } {
  const line: CalendarItem[] = [];
  const rest: CalendarItem[] = [];
  for (const it of items) {
    const multi = lastDay(it) !== dayOf(it.start);
    if (multi && dayOf(it.start) <= span.from && lastDay(it) >= span.to) line.push(it);
    else rest.push(it);
  }
  line.sort((a, b) => rankOf(a) - rankOf(b) || a.title.localeCompare(b.title, "ko"));
  return { line, rest };
}

/** Bar lanes per week row (3.3: at most two; the rest count toward the day's "+n"). */
export const MAX_LANES = 2;
/** Month cell line budget (bars + items) before "+n" (3.2). */
export const MONTH_LINES = 3;
/** 2-week cell line budget (13.2: five lines, else four + "+n"). */
export const TWO_WEEK_LINES = 5;

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

export type DayCell = {
  day: string;
  /** Single-day items shown in the cell. */
  shown: CalendarItem[];
  /** "+n" (0 = none): hidden items plus bars that did not get a lane. */
  hidden: number;
  /** Everything on the day (bars included), for the "+n" popover and labels. */
  all: CalendarItem[];
};

export type WeekLayout = { days: string[]; bars: WeekBar[]; lanes: number; cells: DayCell[] };

/**
 * One week row: multi-day items packed into lanes (earliest, then longest first), at most
 * `MAX_LANES`; single-day items per day. `budget` = lines per cell (null = show all).
 */
export function layoutWeek(
  items: readonly CalendarItem[],
  days: readonly string[],
  budget: number | null,
): WeekLayout {
  const from = days[0]!;
  const to = days.at(-1)!;
  const singles = days.map(() => [] as CalendarItem[]);
  const multi: { item: CalendarItem; first: string; last: string }[] = [];
  for (const item of items) {
    const first = dayOf(item.start);
    const last = lastDay(item);
    if (last < from || first > to) continue;
    if (first === last) singles[days.indexOf(first)]?.push(item);
    else multi.push({ item, first, last });
  }
  multi.sort(
    (a, b) =>
      a.first.localeCompare(b.first) ||
      b.last.localeCompare(a.last) ||
      compareItems(a.item, b.item),
  );
  const laneEnds: number[] = [];
  const bars: WeekBar[] = [];
  const overflowBars = days.map(() => 0);
  for (const { item, first, last } of multi) {
    const col = first < from ? 0 : days.indexOf(first);
    const end = last > to ? days.length - 1 : days.indexOf(last);
    let lane = laneEnds.findIndex((e) => e < col);
    if (lane < 0) lane = laneEnds.length;
    if (lane >= MAX_LANES) {
      for (let i = col; i <= end; i++) overflowBars[i]!++;
      continue;
    }
    laneEnds[lane] = end;
    bars.push({
      item,
      col,
      span: end - col + 1,
      lane,
      continuesBefore: first < from,
      continuesAfter: last > to,
    });
  }
  const lanes = laneEnds.length;
  const cells = days.map((day, i): DayCell => {
    const list = singles[i]!.sort(compareItems);
    const all = [
      ...multi.filter((m) => m.first <= day && day <= m.last).map((m) => m.item),
      ...list,
    ].sort(compareItems);
    if (budget === null) return { day, shown: list, hidden: 0, all };
    const slots = Math.max(0, budget - lanes);
    const total = list.length + overflowBars[i]!;
    if (total <= slots) return { day, shown: list, hidden: 0, all };
    const keep = Math.max(0, slots - 1);
    return { day, shown: list.slice(0, keep), hidden: total - keep, all };
  });
  return { days: [...days], bars, lanes, cells };
}

/** Dots for a day (8절·9절): first three sources in cell order; tasks hollow if all done. */
export function dayDots(
  dayItems: readonly CalendarItem[],
): { source: CalendarItem["source"]; hollow: boolean }[] {
  const out: { source: CalendarItem["source"]; hollow: boolean }[] = [];
  const sorted = [...dayItems].sort(compareItems);
  for (const it of sorted) {
    const seen = out.find((d) => d.source === it.source);
    if (seen) {
      if (it.source === "task" && !it.done) seen.hollow = false;
      continue;
    }
    if (out.length === 3) continue;
    out.push({ source: it.source, hollow: it.source === "task" && !!it.done });
  }
  return out;
}

/** Moves an item to `date` (optimistic drag/keyboard update). */
export function moveItemTo(
  items: readonly CalendarItem[],
  id: string,
  date: string,
): CalendarItem[] {
  return items.map((it) => (it.id === id ? { ...it, start: date, end: undefined } : it));
}

// ---- keyboard -------------------------------------------------------------------------

/** Day a grid key moves to (calendar.md 5.2); null = key not handled. */
export function navDay(kind: CalendarRangeKind, day: string, key: string): string | null {
  switch (key) {
    case "ArrowLeft":
      return addDays(day, -1);
    case "ArrowRight":
      return addDays(day, 1);
    case "ArrowUp":
      return addDays(day, -7);
    case "ArrowDown":
      return addDays(day, 7);
    case "Home":
      return startOfWeek(day);
    case "End":
      return addDays(startOfWeek(day), 6);
    case "PageUp":
      return stepDate(kind, day, -1);
    case "PageDown":
      return stepDate(kind, day, 1);
    default:
      return null;
  }
}

/** Monday after `today`. */
export const nextMonday = (today: string) => addDays(startOfWeek(today), 7);

/**
 * Undo one failed save: puts back only the fields that change (`start`, `end`, `done`) of
 * `original`, leaving other items (and later changes to them) alone.
 */
export function revertItem(items: readonly CalendarItem[], original: CalendarItem): CalendarItem[] {
  return items.map((it) =>
    it.id === original.id
      ? { ...it, start: original.start, end: original.end, done: original.done }
      : it,
  );
}
