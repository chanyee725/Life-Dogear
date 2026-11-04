/**
 * ICS → calendar items for one range. Recurring events (RRULE, RDATE, EXDATE) are
 * expanded only through the range, with caps on how far one event may iterate and how
 * many items one feed may yield. Moved or cancelled occurrences (RECURRENCE-ID) replace
 * the master's occurrence. Times are shown in `zone` (default Asia/Seoul).
 *
 * Simple rules (one RRULE, no COUNT, SECONDLY…WEEKLY) start iterating just before the range
 * instead of at DTSTART, by moving the start a whole number of intervals: the series is the
 * same, so an hourly event from 2000 costs only the range's hours.
 */
import ICAL from "ical.js";
import { addDays, CALENDAR_TZ, overlaps } from "../dates";
import { cleanUid } from "../uid";
import type { CalendarItem, CalendarRange } from "../types";
import { isKnownZone, msToZonedIso, wallToMs } from "./zone";

/** Occurrences one recurring event may step through within one range. */
export const MAX_ITERATIONS_PER_EVENT = 5000;
/** Occurrences all events of one feed may step through for one range. */
export const MAX_ITERATIONS_PER_FEED = 50_000;
/** Items one feed may add to one response. */
export const MAX_ITEMS_PER_FEED = 1500;
/** Events one feed may hold; the rest are ignored. */
export const MAX_EVENTS_PER_FEED = 20_000;
export const TITLE_MAX = 300;
const UNTITLED = "(제목 없음)";

export type ParsedFeed = {
  /** Zone for floating times and unknown TZIDs. */
  zone: string;
  events: ICAL.Component[];
};

export class IcsParseError extends Error {
  override name = "IcsParseError";
  constructor(readonly code: string) {
    super(code);
  }
}

/** Parses ICS text once (cacheable); throws `IcsParseError` when it is not a calendar. */
export function parseIcs(text: string, fallbackZone = CALENDAR_TZ): ParsedFeed {
  let root: ICAL.Component;
  try {
    root = new ICAL.Component(ICAL.parse(text) as unknown[]);
  } catch {
    throw new IcsParseError("syntax");
  }
  if (root.name !== "vcalendar") throw new IcsParseError("not_calendar");
  for (const tz of root.getAllSubcomponents("vtimezone")) {
    const tzid = tz.getFirstPropertyValue("tzid");
    // Register each zone once; never replace one already known (e.g. UTC).
    if (typeof tzid === "string" && tzid && !ICAL.TimezoneService.has(tzid)) {
      try {
        ICAL.TimezoneService.register(tz);
      } catch {
        // A broken VTIMEZONE: its times fall back to `Intl` or the default zone.
      }
    }
  }
  const calZone = root.getFirstPropertyValue("x-wr-timezone");
  return {
    zone: isKnownZone(typeof calZone === "string" ? calZone : null)
      ? (calZone as string)
      : fallbackZone,
    events: root.getAllSubcomponents("vevent").slice(0, MAX_EVENTS_PER_FEED),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
const dayOf = (t: ICAL.Time) => `${t.year}-${pad(t.month)}-${pad(t.day)}`;

/** TZID kept on a time whose zone has no VTIMEZONE (ical.js leaves it floating). */
const namedZone = (t: ICAL.Time): string | undefined =>
  (t as unknown as { timezone?: string }).timezone;

/**
 * Instant of a date-time: UTC and registered zones via ical.js, the rest via `Intl` in its
 * own TZID, else `sourceZone` (the series' TZID: recurrence occurrences lose it), else `zone`.
 */
function toMs(t: ICAL.Time, zone: string, sourceZone?: string): number {
  const tzid = t.zone?.tzid;
  if (tzid && tzid !== "floating") return t.toUnixTime() * 1000;
  const named = namedZone(t);
  if (isKnownZone(named)) return wallToMs(t, named);
  return wallToMs(t, isKnownZone(sourceZone) ? sourceZone : zone);
}

/** Google Calendar day view; ICS feeds carry no per-event link without the calendar id. */
const dayLink = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return `https://calendar.google.com/calendar/r/day/${y}/${m}/${d}`;
};

function cleanTitle(value: unknown): string {
  const title = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!title) return UNTITLED;
  return title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX - 1)}…` : title;
}

const cancelled = (c: ICAL.Component) =>
  String(c.getFirstPropertyValue("status") ?? "").toUpperCase() === "CANCELLED";

type Occurrence = {
  start: ICAL.Time;
  durationSec: number;
  /** TZID of the series start, for occurrences without their own. */
  sourceZone?: string;
};

/** One item, or null when it falls outside the range. */
function toItem(
  uid: string,
  title: string,
  occ: Occurrence,
  range: CalendarRange,
  zone: string,
): CalendarItem | null {
  if (occ.start.isDate) {
    const start = dayOf(occ.start);
    const days = Math.max(1, Math.round(occ.durationSec / 86_400));
    const end = addDays(start, days - 1);
    if (!overlaps(start, end, range)) return null;
    return {
      id: `google:${uid}:${start}`,
      source: "google",
      title,
      start,
      ...(end !== start ? { end } : {}),
      allDay: true,
      href: dayLink(start),
    };
  }
  const startMs = toMs(occ.start, zone, occ.sourceZone);
  const endMs = startMs + Math.max(0, occ.durationSec) * 1000;
  const start = msToZonedIso(startMs, zone);
  // An event ending exactly at midnight does not occupy the next day.
  const lastDay = msToZonedIso(Math.max(startMs, endMs - 1), zone).slice(0, 10);
  if (!overlaps(start.slice(0, 10), lastDay, range)) return null;
  return {
    id: `google:${uid}:${start}`,
    source: "google",
    title,
    start,
    ...(endMs > startMs ? { end: msToZonedIso(endMs, zone) } : {}),
    allDay: false,
    href: dayLink(start.slice(0, 10)),
  };
}

const UNIT_SECONDS: Partial<Record<string, number>> = {
  SECONDLY: 1,
  MINUTELY: 60,
  HOURLY: 3600,
  DAILY: 86_400,
  WEEKLY: 7 * 86_400,
};

/**
 * A start at least a day before `targetDay` that yields the same occurrences from there on,
 * or undefined to iterate from DTSTART. Only for one RRULE without COUNT (COUNT needs every
 * earlier occurrence). The moved start itself is returned as an occurrence even if the rule
 * would skip it; it lies before the range, so the range filter drops it.
 */
export function fastForwardStart(ev: ICAL.Event, targetDay: string): ICAL.Time | undefined {
  const rules = ev.component.getAllProperties("rrule");
  if (rules.length !== 1) return undefined;
  const recur = rules[0]!.getFirstValue() as ICAL.Recur;
  if (!recur || recur.count) return undefined;
  const unit = UNIT_SECONDS[recur.freq];
  if (!unit) return undefined;
  const step = unit * Math.max(1, recur.interval || 1);
  const start = ev.startDate;
  const [y, m, d] = targetDay.split("-").map(Number) as [number, number, number];
  const target = Date.UTC(y, m - 1, d) / 1000;
  const from =
    Date.UTC(start.year, start.month - 1, start.day, start.hour, start.minute, start.second) / 1000;
  const k = Math.floor((target - from) / step);
  if (k <= 0) return undefined;
  const moved = start.clone();
  const seconds = k * step;
  // Whole days move the calendar date; the rest moves the clock (wall time, like ical.js).
  moved.adjust(Math.floor(seconds / 86_400), 0, 0, seconds % 86_400);
  return moved;
}

const durationOf = (ev: ICAL.Event): number => {
  try {
    return ev.duration ? ev.duration.toSeconds() : 0;
  } catch {
    return 0;
  }
};

export type Expansion = {
  items: CalendarItem[];
  /** false when a cap stopped expansion, so events in the range may be missing. */
  complete: boolean;
};

/** Items of one parsed feed inside `range`, at most `MAX_ITEMS_PER_FEED`. */
export function expandIcs(feed: ParsedFeed, range: CalendarRange): Expansion {
  const { zone } = feed;
  const out: CalendarItem[] = [];
  let complete = true;
  let budget = MAX_ITERATIONS_PER_FEED;
  const push = (item: CalendarItem | null) => {
    if (!item) return;
    if (out.length < MAX_ITEMS_PER_FEED) out.push(item);
    else complete = false;
  };
  // Stop iterating a little past the range: zone shifts move a time by at most a day.
  const stopAfter = addDays(range.to, 1);
  const startFloor = addDays(range.from, -1);

  // Overrides by UID, keyed by the instant they replace.
  const overrides = new Map<string, Set<number>>();
  const masters: ICAL.Component[] = [];
  for (const c of feed.events) {
    const rid = c.getFirstPropertyValue("recurrence-id");
    if (rid instanceof ICAL.Time) {
      const uid = String(c.getFirstPropertyValue("uid") ?? "");
      const key = rid.isDate ? Date.UTC(rid.year, rid.month - 1, rid.day) : toMs(rid, zone);
      if (!overrides.has(uid)) overrides.set(uid, new Set());
      overrides.get(uid)!.add(key);
      // The override itself is a one-off event (unless it cancels the occurrence).
      if (!cancelled(c)) masters.push(c);
    } else if (!cancelled(c)) {
      masters.push(c);
    }
  }

  for (const c of masters) {
    if (out.length >= MAX_ITEMS_PER_FEED || budget <= 0) {
      complete = false;
      break;
    }
    let ev: ICAL.Event;
    try {
      ev = new ICAL.Event(c);
    } catch {
      continue;
    }
    const start = ev.startDate;
    if (!(start instanceof ICAL.Time)) continue;
    const uid = cleanUid(ev.uid);
    const title = cleanTitle(ev.summary);
    const durationSec = durationOf(ev);
    const isOverride = c.hasProperty("recurrence-id");

    if (isOverride || !ev.isRecurring()) {
      push(toItem(uid, title, { start, durationSec }, range, zone));
      continue;
    }

    const sourceZone = namedZone(start);
    const skip = overrides.get(String(c.getFirstPropertyValue("uid") ?? ""));
    let it: ICAL.RecurExpansion;
    try {
      const durationDays = Math.ceil(durationSec / 86_400);
      it = ev.iterator(fastForwardStart(ev, addDays(range.from, -(durationDays + 2))));
    } catch {
      continue;
    }
    let finished = false;
    for (let i = 0; i < MAX_ITERATIONS_PER_EVENT && budget > 0; i++, budget--) {
      let occ: ICAL.Time | undefined;
      try {
        occ = it.next();
      } catch {
        finished = true;
        break;
      }
      const day = occ ? dayOf(occ) : "";
      if (!occ || day > stopAfter) {
        finished = true;
        break;
      }
      // Long events can start before the range and reach into it; durations decide below.
      if (day < startFloor && addDays(day, Math.ceil(durationSec / 86_400) + 1) < range.from) {
        continue;
      }
      if (skip) {
        const key = occ.isDate
          ? Date.UTC(occ.year, occ.month - 1, occ.day)
          : toMs(occ, zone, sourceZone);
        if (skip.has(key)) continue;
      }
      push(toItem(uid, title, { start: occ, durationSec, sourceZone }, range, zone));
      if (out.length >= MAX_ITEMS_PER_FEED && !complete) break;
    }
    if (!finished) complete = false;
  }
  return { items: out, complete };
}
