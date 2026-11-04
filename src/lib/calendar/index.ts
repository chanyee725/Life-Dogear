import "server-only";
import { RepoError } from "@/lib/repo/shared";
import { collectAppItems } from "./collect";
import { MAX_RANGE_DAYS, parseRange } from "./dates";
import { loadGoogleItems } from "./ics";
import type { CalendarItem, CalendarOptions, CalendarRange, CalendarResult } from "./types";

export type * from "./types";
export { MAX_RANGE_DAYS, parseRange } from "./dates";

/** Sort key: by start day, all-day before timed, then title. */
const compare = (a: CalendarItem, b: CalendarItem) =>
  a.start.slice(0, 10).localeCompare(b.start.slice(0, 10)) ||
  Number(b.allDay) - Number(a.allDay) ||
  a.start.localeCompare(b.start) ||
  a.title.localeCompare(b.title);

/**
 * Everything dated in `range` (inclusive `YYYY-MM-DD`, at most `MAX_RANGE_DAYS`): app dates
 * plus Google Calendar events when `GOOGLE_CALENDAR_ICS_URLS` is set. Google failures never
 * throw; they show up as `google: "error"`.
 */
export async function getCalendar(
  range: CalendarRange,
  opts: CalendarOptions = {},
): Promise<CalendarResult> {
  const valid = parseRange(range);
  if (!valid) {
    throw new RepoError("invalid", `날짜 범위가 올바르지 않습니다(최대 ${MAX_RANGE_DAYS}일).`);
  }
  const [app, google] = await Promise.all([collectAppItems(valid, opts), loadGoogleItems(valid)]);
  return { items: [...app, ...google.items].sort(compare), google: google.status };
}
