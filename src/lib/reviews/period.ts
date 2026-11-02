/**
 * Review periods. Pure and client-safe. Dates use the machine's local calendar (the app
 * runs locally for one user). Values sort lexicographically within a kind:
 * week `2026-W45` (ISO 8601 week), month `2026-11`, quarter `2026-Q4`, year `2026`.
 */
import type { ReviewKind } from "@/lib/enums";

const PATTERN: Record<ReviewKind, RegExp> = {
  week: /^(\d{4})-W(\d{2})$/,
  month: /^(\d{4})-(\d{2})$/,
  quarter: /^(\d{4})-Q([1-4])$/,
  year: /^(\d{4})$/,
};

const KIND_TITLE: Record<ReviewKind, string> = {
  week: "주간 회고",
  month: "월간 회고",
  quarter: "분기 회고",
  year: "연간 회고",
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Local date at midnight. */
const day = (y: number, m: number, d: number) => new Date(y, m, d);

/** ISO weekday 1 (Mon) .. 7 (Sun). */
const isoWeekday = (date: Date) => ((date.getDay() + 6) % 7) + 1;

/** ISO week-numbering year and week of `date`. */
export function isoWeek(date: Date): { year: number; week: number } {
  // The Thursday of this week decides the year.
  const thursday = day(date.getFullYear(), date.getMonth(), date.getDate() + 4 - isoWeekday(date));
  const jan1 = day(thursday.getFullYear(), 0, 1);
  const dayOfYear = Math.round((thursday.getTime() - jan1.getTime()) / 86_400_000);
  return { year: thursday.getFullYear(), week: Math.floor(dayOfYear / 7) + 1 };
}

/** Monday of ISO week `week` in ISO year `year`. */
function isoWeekMonday(year: number, week: number): Date {
  const jan4 = day(year, 0, 4);
  return day(year, 0, 4 - isoWeekday(jan4) + 1 + (week - 1) * 7);
}

const weeksInYear = (year: number) => isoWeek(day(year, 11, 28)).week;

export function periodOf(kind: ReviewKind, date: Date): string {
  const y = date.getFullYear();
  switch (kind) {
    case "week": {
      const w = isoWeek(date);
      return `${w.year}-W${pad(w.week)}`;
    }
    case "month":
      return `${y}-${pad(date.getMonth() + 1)}`;
    case "quarter":
      return `${y}-Q${Math.floor(date.getMonth() / 3) + 1}`;
    case "year":
      return String(y);
  }
}

export function isValidPeriod(kind: ReviewKind, period: unknown): period is string {
  if (typeof period !== "string") return false;
  const m = PATTERN[kind].exec(period);
  if (!m) return false;
  const year = Number(m[1]);
  if (year < 1900 || year > 9999) return false;
  if (kind === "week") return Number(m[2]) >= 1 && Number(m[2]) <= weeksInYear(year);
  if (kind === "month") return Number(m[2]) >= 1 && Number(m[2]) <= 12;
  return true;
}

/** First and last day (inclusive, local midnight) of a valid period. */
export function periodRange(kind: ReviewKind, period: string): { start: Date; end: Date } {
  const m = PATTERN[kind].exec(period)!;
  const year = Number(m[1]);
  switch (kind) {
    case "week": {
      const start = isoWeekMonday(year, Number(m[2]));
      return { start, end: day(start.getFullYear(), start.getMonth(), start.getDate() + 6) };
    }
    case "month": {
      const month = Number(m[2]) - 1;
      return { start: day(year, month, 1), end: day(year, month + 1, 0) };
    }
    case "quarter": {
      const q = Number(m[2]) - 1;
      return { start: day(year, q * 3, 1), end: day(year, q * 3 + 3, 0) };
    }
    case "year":
      return { start: day(year, 0, 1), end: day(year, 11, 31) };
  }
}

/** The period `offset` steps away (−1 = previous, 1 = next). */
export function shiftPeriod(kind: ReviewKind, period: string, offset: number): string {
  const { start } = periodRange(kind, period);
  switch (kind) {
    case "week":
      return periodOf(
        kind,
        day(start.getFullYear(), start.getMonth(), start.getDate() + 7 * offset),
      );
    case "month":
      return periodOf(kind, day(start.getFullYear(), start.getMonth() + offset, 1));
    case "quarter":
      return periodOf(kind, day(start.getFullYear(), start.getMonth() + 3 * offset, 1));
    case "year":
      return String(start.getFullYear() + offset);
  }
}

/** Stored title, e.g. "2026-W45 주간 회고" (used by links, search and `[[…]]`). */
export function reviewTitle(kind: ReviewKind, period: string): string {
  return `${period} ${KIND_TITLE[kind]}`;
}

const md = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;

/** Human label, e.g. "2026년 45주차 (11/2–11/8)", "2026년 11월", "2026년 4분기", "2026년". */
export function periodLabel(kind: ReviewKind, period: string): string {
  const m = PATTERN[kind].exec(period);
  if (!m) return period;
  const year = m[1];
  switch (kind) {
    case "week": {
      const { start, end } = periodRange(kind, period);
      return `${year}년 ${Number(m[2])}주차 (${md(start)}–${md(end)})`;
    }
    case "month":
      return `${year}년 ${Number(m[2])}월`;
    case "quarter":
      return `${year}년 ${m[2]}분기`;
    case "year":
      return `${year}년`;
  }
}

/** Quarter (`2026-Q4`) and year (`2026`) a period falls in, for goal snapshots. */
export function goalPeriodsFor(
  kind: ReviewKind,
  period: string,
): { quarters: string[]; year: string } {
  const { start, end } = periodRange(kind, period);
  if (kind === "year") {
    return { quarters: [1, 2, 3, 4].map((q) => `${period}-Q${q}`), year: period };
  }
  // A week can straddle two quarters (and years); use the quarter of its Thursday,
  // which also matches the ISO year of the week.
  const anchor =
    kind === "week" ? day(start.getFullYear(), start.getMonth(), start.getDate() + 3) : end;
  return { quarters: [periodOf("quarter", anchor)], year: String(anchor.getFullYear()) };
}

/**
 * Which weekly review the home screen should nudge for: the current week on Sunday,
 * the previous week on Monday (one day of grace), otherwise none.
 */
export function weeklyReviewDue(today: Date): string | null {
  const weekday = isoWeekday(today);
  if (weekday === 7) return periodOf("week", today);
  if (weekday === 1) {
    return periodOf("week", day(today.getFullYear(), today.getMonth(), today.getDate() - 1));
  }
  return null;
}
