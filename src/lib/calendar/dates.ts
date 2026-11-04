/**
 * Calendar date helpers. Pure. Calendar days are `YYYY-MM-DD` strings; review and goal
 * periods use the same local-calendar rules as `@/lib/reviews/period`.
 */
import { periodOf, periodRange } from "@/lib/reviews/period";
import type { CalendarRange } from "./types";

/** Time zone for timestamps shown as calendar days (and the ICS default). */
export const CALENDAR_TZ = "Asia/Seoul";

/** Longest range one request may ask for (a month view with spill-over weeks fits easily). */
export const MAX_RANGE_DAYS = 93;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (n: number) => String(n).padStart(2, "0");

/** Local `Date` → `YYYY-MM-DD`. */
export const localDay = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** `YYYY-MM-DD` → local midnight, or null when it is not a real date. */
export function parseDay(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const m = DATE_RE.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return localDay(d) === value ? d : null;
}

export const addDays = (day: string, n: number): string => {
  const d = parseDay(day)!;
  return localDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
};

/** Inclusive day count from `from` to `to`. */
export const daySpan = (from: string, to: string): number =>
  Math.round((parseDay(to)!.getTime() - parseDay(from)!.getTime()) / 86_400_000) + 1;

/** Valid range, or null (bad dates, `to` before `from`, or longer than `MAX_RANGE_DAYS`). */
export function parseRange(range: { from?: unknown; to?: unknown }): CalendarRange | null {
  const from = parseDay(range.from);
  const to = parseDay(range.to);
  if (!from || !to || to < from) return null;
  const r = { from: range.from as string, to: range.to as string };
  return daySpan(r.from, r.to) <= MAX_RANGE_DAYS ? r : null;
}

/** Whether `[start, end]` overlaps the range (all inclusive `YYYY-MM-DD`). */
export const overlaps = (start: string, end: string, range: CalendarRange): boolean =>
  start <= range.to && end >= range.from;

/** Every week / month / quarter period touching the range, in order, without repeats. */
export function periodsIn(kind: "week" | "month" | "quarter", range: CalendarRange): string[] {
  const out: string[] = [];
  const step = kind === "week" ? 7 : 1;
  for (let day = range.from; day <= range.to; day = addDays(day, step)) {
    const p = periodOf(kind, parseDay(day)!);
    if (out.at(-1) !== p) out.push(p);
  }
  const last = periodOf(kind, parseDay(range.to)!);
  if (out.at(-1) !== last) out.push(last);
  return out;
}

/** First and last day of a period as `YYYY-MM-DD`. */
export function periodDays(
  kind: "week" | "month" | "quarter",
  period: string,
): { start: string; end: string } {
  const { start, end } = periodRange(kind, period);
  return { start: localDay(start), end: localDay(end) };
}

/** Calendar day of an ISO timestamp in `CALENDAR_TZ`. */
export function dayInZone(iso: string, timeZone = CALENDAR_TZ): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
